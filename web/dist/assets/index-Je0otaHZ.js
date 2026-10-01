(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))n(s);new MutationObserver(s=>{for(const r of s)if(r.type==="childList")for(const o of r.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&n(o)}).observe(document,{childList:!0,subtree:!0});function e(s){const r={};return s.integrity&&(r.integrity=s.integrity),s.referrerPolicy&&(r.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?r.credentials="include":s.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function n(s){if(s.ep)return;s.ep=!0;const r=e(s);fetch(s.href,r)}})();/**
 * @license
 * Copyright 2010-2024 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const Sl="170",Zi={ROTATE:0,DOLLY:1,PAN:2},$i={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},vd=0,Ql=1,_d=2,Jh=1,Qh=2,Dn=3,bn=0,Ye=1,je=2,ti=0,xi=1,Ws=2,tc=3,ec=4,uo=5,_n=100,Md=101,xd=102,yd=103,bd=104,no=200,yi=201,tu=202,Sd=203,Pa=204,qs=205,wd=206,Ed=207,Td=208,Ad=209,Cd=210,Rd=211,Pd=212,Ld=213,Id=214,La=0,Ia=1,Da=2,es=3,Ua=4,Na=5,Oa=6,Fa=7,eu=0,Dd=1,Ud=2,ei=0,Nd=1,Od=2,Fd=3,Bd=4,kd=5,zd=6,nu=7,iu=300,ns=301,is=302,Ba=303,ka=304,fo=306,ss=1e3,vi=1001,za=1002,en=1003,Hd=1004,hr=1005,Mn=1006,Co=1007,_i=1008,On=1009,su=1010,ru=1011,Ys=1012,wl=1013,bi=1014,xn=1015,er=1016,El=1017,Tl=1018,rs=1020,ou=35902,au=1021,lu=1022,mn=1023,cu=1024,hu=1025,Ji=1026,os=1027,Al=1028,Cl=1029,uu=1030,Rl=1031,Pl=1033,Xr=33776,$r=33777,jr=33778,Kr=33779,Ha=35840,Va=35841,Ga=35842,Wa=35843,qa=36196,Ya=37492,Xa=37496,$a=37808,ja=37809,Ka=37810,Za=37811,Ja=37812,Qa=37813,tl=37814,el=37815,nl=37816,il=37817,sl=37818,rl=37819,ol=37820,al=37821,Zr=36492,ll=36494,cl=36495,du=36283,hl=36284,ul=36285,dl=36286,Vd=3200,Gd=3201,fu=0,Wd=1,Zn="",we="srgb",ii="srgb-linear",po="linear",ae="srgb",Pi=7680,nc=519,qd=512,Yd=513,Xd=514,pu=515,$d=516,jd=517,Kd=518,Zd=519,ic=35044,Qn=35048,sc="300 es",Un=2e3,io=2001;class Ei{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[t]===void 0&&(n[t]=[]),n[t].indexOf(e)===-1&&n[t].push(e)}hasEventListener(t,e){if(this._listeners===void 0)return!1;const n=this._listeners;return n[t]!==void 0&&n[t].indexOf(e)!==-1}removeEventListener(t,e){if(this._listeners===void 0)return;const s=this._listeners[t];if(s!==void 0){const r=s.indexOf(e);r!==-1&&s.splice(r,1)}}dispatchEvent(t){if(this._listeners===void 0)return;const n=this._listeners[t.type];if(n!==void 0){t.target=this;const s=n.slice(0);for(let r=0,o=s.length;r<o;r++)s[r].call(this,t);t.target=null}}}const Be=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];let rc=1234567;const Ds=Math.PI/180,Xs=180/Math.PI;function Ti(){const i=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Be[i&255]+Be[i>>8&255]+Be[i>>16&255]+Be[i>>24&255]+"-"+Be[t&255]+Be[t>>8&255]+"-"+Be[t>>16&15|64]+Be[t>>24&255]+"-"+Be[e&63|128]+Be[e>>8&255]+"-"+Be[e>>16&255]+Be[e>>24&255]+Be[n&255]+Be[n>>8&255]+Be[n>>16&255]+Be[n>>24&255]).toLowerCase()}function be(i,t,e){return Math.max(t,Math.min(e,i))}function Ll(i,t){return(i%t+t)%t}function Jd(i,t,e,n,s){return n+(i-t)*(s-n)/(e-t)}function Qd(i,t,e){return i!==t?(e-i)/(t-i):0}function Us(i,t,e){return(1-e)*i+e*t}function tf(i,t,e,n){return Us(i,t,1-Math.exp(-e*n))}function ef(i,t=1){return t-Math.abs(Ll(i,t*2)-t)}function nf(i,t,e){return i<=t?0:i>=e?1:(i=(i-t)/(e-t),i*i*(3-2*i))}function sf(i,t,e){return i<=t?0:i>=e?1:(i=(i-t)/(e-t),i*i*i*(i*(i*6-15)+10))}function rf(i,t){return i+Math.floor(Math.random()*(t-i+1))}function of(i,t){return i+Math.random()*(t-i)}function af(i){return i*(.5-Math.random())}function lf(i){i!==void 0&&(rc=i);let t=rc+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function cf(i){return i*Ds}function hf(i){return i*Xs}function uf(i){return(i&i-1)===0&&i!==0}function df(i){return Math.pow(2,Math.ceil(Math.log(i)/Math.LN2))}function ff(i){return Math.pow(2,Math.floor(Math.log(i)/Math.LN2))}function pf(i,t,e,n,s){const r=Math.cos,o=Math.sin,a=r(e/2),l=o(e/2),c=r((t+n)/2),h=o((t+n)/2),u=r((t-n)/2),d=o((t-n)/2),f=r((n-t)/2),g=o((n-t)/2);switch(s){case"XYX":i.set(a*h,l*u,l*d,a*c);break;case"YZY":i.set(l*d,a*h,l*u,a*c);break;case"ZXZ":i.set(l*u,l*d,a*h,a*c);break;case"XZX":i.set(a*h,l*g,l*f,a*c);break;case"YXY":i.set(l*f,a*h,l*g,a*c);break;case"ZYZ":i.set(l*g,l*f,a*h,a*c);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+s)}}function Xi(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("Invalid component type.")}}function Ge(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("Invalid component type.")}}const Il={DEG2RAD:Ds,RAD2DEG:Xs,generateUUID:Ti,clamp:be,euclideanModulo:Ll,mapLinear:Jd,inverseLerp:Qd,lerp:Us,damp:tf,pingpong:ef,smoothstep:nf,smootherstep:sf,randInt:rf,randFloat:of,randFloatSpread:af,seededRandom:lf,degToRad:cf,radToDeg:hf,isPowerOfTwo:uf,ceilPowerOfTwo:df,floorPowerOfTwo:ff,setQuaternionFromProperEuler:pf,normalize:Ge,denormalize:Xi};class H{constructor(t=0,e=0){H.prototype.isVector2=!0,this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){const e=this.x,n=this.y,s=t.elements;return this.x=s[0]*e+s[3]*n+s[6],this.y=s[1]*e+s[4]*n+s[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const n=this.dot(t)/e;return Math.acos(be(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,n=this.y-t.y;return e*e+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){const n=Math.cos(e),s=Math.sin(e),r=this.x-t.x,o=this.y-t.y;return this.x=r*n-o*s+t.x,this.y=r*s+o*n+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class qt{constructor(t,e,n,s,r,o,a,l,c){qt.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,o,a,l,c)}set(t,e,n,s,r,o,a,l,c){const h=this.elements;return h[0]=t,h[1]=s,h[2]=a,h[3]=e,h[4]=r,h[5]=l,h[6]=n,h[7]=o,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){const e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],this}extractBasis(t,e,n){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(t){const e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const n=t.elements,s=e.elements,r=this.elements,o=n[0],a=n[3],l=n[6],c=n[1],h=n[4],u=n[7],d=n[2],f=n[5],g=n[8],_=s[0],m=s[3],p=s[6],x=s[1],M=s[4],v=s[7],A=s[2],E=s[5],R=s[8];return r[0]=o*_+a*x+l*A,r[3]=o*m+a*M+l*E,r[6]=o*p+a*v+l*R,r[1]=c*_+h*x+u*A,r[4]=c*m+h*M+u*E,r[7]=c*p+h*v+u*R,r[2]=d*_+f*x+g*A,r[5]=d*m+f*M+g*E,r[8]=d*p+f*v+g*R,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){const t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],o=t[4],a=t[5],l=t[6],c=t[7],h=t[8];return e*o*h-e*a*c-n*r*h+n*a*l+s*r*c-s*o*l}invert(){const t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],o=t[4],a=t[5],l=t[6],c=t[7],h=t[8],u=h*o-a*c,d=a*l-h*r,f=c*r-o*l,g=e*u+n*d+s*f;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);const _=1/g;return t[0]=u*_,t[1]=(s*c-h*n)*_,t[2]=(a*n-s*o)*_,t[3]=d*_,t[4]=(h*e-s*l)*_,t[5]=(s*r-a*e)*_,t[6]=f*_,t[7]=(n*l-c*e)*_,t[8]=(o*e-n*r)*_,this}transpose(){let t;const e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){const e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,n,s,r,o,a){const l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*o+c*a)+o+t,-s*c,s*l,-s*(-c*o+l*a)+a+e,0,0,1),this}scale(t,e){return this.premultiply(Ro.makeScale(t,e)),this}rotate(t){return this.premultiply(Ro.makeRotation(-t)),this}translate(t,e){return this.premultiply(Ro.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,n,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){const e=this.elements,n=t.elements;for(let s=0;s<9;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<9;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){const n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t}clone(){return new this.constructor().fromArray(this.elements)}}const Ro=new qt;function mu(i){for(let t=i.length-1;t>=0;--t)if(i[t]>=65535)return!0;return!1}function so(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function mf(){const i=so("canvas");return i.style.display="block",i}const oc={};function Ts(i){i in oc||(oc[i]=!0,console.warn(i))}function gf(i,t,e){return new Promise(function(n,s){function r(){switch(i.clientWaitSync(t,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(r,e);break;default:n()}}setTimeout(r,e)})}function vf(i){const t=i.elements;t[2]=.5*t[2]+.5*t[3],t[6]=.5*t[6]+.5*t[7],t[10]=.5*t[10]+.5*t[11],t[14]=.5*t[14]+.5*t[15]}function _f(i){const t=i.elements;t[11]===-1?(t[10]=-t[10]-1,t[14]=-t[14]):(t[10]=-t[10],t[14]=-t[14]+1)}const Qt={enabled:!0,workingColorSpace:ii,spaces:{},convert:function(i,t,e){return this.enabled===!1||t===e||!t||!e||(this.spaces[t].transfer===ae&&(i.r=Nn(i.r),i.g=Nn(i.g),i.b=Nn(i.b)),this.spaces[t].primaries!==this.spaces[e].primaries&&(i.applyMatrix3(this.spaces[t].toXYZ),i.applyMatrix3(this.spaces[e].fromXYZ)),this.spaces[e].transfer===ae&&(i.r=Qi(i.r),i.g=Qi(i.g),i.b=Qi(i.b))),i},fromWorkingColorSpace:function(i,t){return this.convert(i,this.workingColorSpace,t)},toWorkingColorSpace:function(i,t){return this.convert(i,t,this.workingColorSpace)},getPrimaries:function(i){return this.spaces[i].primaries},getTransfer:function(i){return i===Zn?po:this.spaces[i].transfer},getLuminanceCoefficients:function(i,t=this.workingColorSpace){return i.fromArray(this.spaces[t].luminanceCoefficients)},define:function(i){Object.assign(this.spaces,i)},_getMatrix:function(i,t,e){return i.copy(this.spaces[t].toXYZ).multiply(this.spaces[e].fromXYZ)},_getDrawingBufferColorSpace:function(i){return this.spaces[i].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(i=this.workingColorSpace){return this.spaces[i].workingColorSpaceConfig.unpackColorSpace}};function Nn(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function Qi(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}const ac=[.64,.33,.3,.6,.15,.06],lc=[.2126,.7152,.0722],cc=[.3127,.329],hc=new qt().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),uc=new qt().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);Qt.define({[ii]:{primaries:ac,whitePoint:cc,transfer:po,toXYZ:hc,fromXYZ:uc,luminanceCoefficients:lc,workingColorSpaceConfig:{unpackColorSpace:we},outputColorSpaceConfig:{drawingBufferColorSpace:we}},[we]:{primaries:ac,whitePoint:cc,transfer:ae,toXYZ:hc,fromXYZ:uc,luminanceCoefficients:lc,outputColorSpaceConfig:{drawingBufferColorSpace:we}}});let Li;class Mf{static getDataURL(t){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let e;if(t instanceof HTMLCanvasElement)e=t;else{Li===void 0&&(Li=so("canvas")),Li.width=t.width,Li.height=t.height;const n=Li.getContext("2d");t instanceof ImageData?n.putImageData(t,0,0):n.drawImage(t,0,0,t.width,t.height),e=Li}return e.width>2048||e.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",t),e.toDataURL("image/jpeg",.6)):e.toDataURL("image/png")}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){const e=so("canvas");e.width=t.width,e.height=t.height;const n=e.getContext("2d");n.drawImage(t,0,0,t.width,t.height);const s=n.getImageData(0,0,t.width,t.height),r=s.data;for(let o=0;o<r.length;o++)r[o]=Nn(r[o]/255)*255;return n.putImageData(s,0,0),e}else if(t.data){const e=t.data.slice(0);for(let n=0;n<e.length;n++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[n]=Math.floor(Nn(e[n]/255)*255):e[n]=Nn(e[n]);return{data:e,width:t.width,height:t.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}}let xf=0;class gu{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:xf++}),this.uuid=Ti(),this.data=t,this.dataReady=!0,this.version=0}set needsUpdate(t){t===!0&&this.version++}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];const n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let o=0,a=s.length;o<a;o++)s[o].isDataTexture?r.push(Po(s[o].image)):r.push(Po(s[o]))}else r=Po(s);n.url=r}return e||(t.images[this.uuid]=n),n}}function Po(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?Mf.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let yf=0;class Ve extends Ei{constructor(t=Ve.DEFAULT_IMAGE,e=Ve.DEFAULT_MAPPING,n=vi,s=vi,r=Mn,o=_i,a=mn,l=On,c=Ve.DEFAULT_ANISOTROPY,h=Zn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:yf++}),this.uuid=Ti(),this.name="",this.source=new gu(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=o,this.anisotropy=c,this.format=a,this.internalFormat=null,this.type=l,this.offset=new H(0,0),this.repeat=new H(1,1),this.center=new H(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new qt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.pmremVersion=0}get image(){return this.source.data}set image(t=null){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];const n={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),e||(t.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==iu)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case ss:t.x=t.x-Math.floor(t.x);break;case vi:t.x=t.x<0?0:1;break;case za:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case ss:t.y=t.y-Math.floor(t.y);break;case vi:t.y=t.y<0?0:1;break;case za:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}}Ve.DEFAULT_IMAGE=null;Ve.DEFAULT_MAPPING=iu;Ve.DEFAULT_ANISOTROPY=1;class ie{constructor(t=0,e=0,n=0,s=1){ie.prototype.isVector4=!0,this.x=t,this.y=e,this.z=n,this.w=s}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,n,s){return this.x=t,this.y=e,this.z=n,this.w=s,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){const e=this.x,n=this.y,s=this.z,r=this.w,o=t.elements;return this.x=o[0]*e+o[4]*n+o[8]*s+o[12]*r,this.y=o[1]*e+o[5]*n+o[9]*s+o[13]*r,this.z=o[2]*e+o[6]*n+o[10]*s+o[14]*r,this.w=o[3]*e+o[7]*n+o[11]*s+o[15]*r,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);const e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,n,s,r;const l=t.elements,c=l[0],h=l[4],u=l[8],d=l[1],f=l[5],g=l[9],_=l[2],m=l[6],p=l[10];if(Math.abs(h-d)<.01&&Math.abs(u-_)<.01&&Math.abs(g-m)<.01){if(Math.abs(h+d)<.1&&Math.abs(u+_)<.1&&Math.abs(g+m)<.1&&Math.abs(c+f+p-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;const M=(c+1)/2,v=(f+1)/2,A=(p+1)/2,E=(h+d)/4,R=(u+_)/4,P=(g+m)/4;return M>v&&M>A?M<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(M),s=E/n,r=R/n):v>A?v<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(v),n=E/s,r=P/s):A<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(A),n=R/r,s=P/r),this.set(n,s,r,e),this}let x=Math.sqrt((m-g)*(m-g)+(u-_)*(u-_)+(d-h)*(d-h));return Math.abs(x)<.001&&(x=1),this.x=(m-g)/x,this.y=(u-_)/x,this.z=(d-h)/x,this.w=Math.acos((c+f+p-1)/2),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this.w=Math.max(t.w,Math.min(e.w,this.w)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this.w=Math.max(t,Math.min(e,this.w)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this.w=t.w+(e.w-t.w)*n,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class bf extends Ei{constructor(t=1,e=1,n={}){super(),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=1,this.scissor=new ie(0,0,t,e),this.scissorTest=!1,this.viewport=new ie(0,0,t,e);const s={width:t,height:e,depth:1};n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Mn,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1},n);const r=new Ve(s,n.mapping,n.wrapS,n.wrapT,n.magFilter,n.minFilter,n.format,n.type,n.anisotropy,n.colorSpace);r.flipY=!1,r.generateMipmaps=n.generateMipmaps,r.internalFormat=n.internalFormat,this.textures=[];const o=n.count;for(let a=0;a<o;a++)this.textures[a]=r.clone(),this.textures[a].isRenderTargetTexture=!0;this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.depthTexture=n.depthTexture,this.samples=n.samples}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}setSize(t,e,n=1){if(this.width!==t||this.height!==e||this.depth!==n){this.width=t,this.height=e,this.depth=n;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=t,this.textures[s].image.height=e,this.textures[s].image.depth=n;this.dispose()}this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let n=0,s=t.textures.length;n<s;n++)this.textures[n]=t.textures[n].clone(),this.textures[n].isRenderTargetTexture=!0;const e=Object.assign({},t.texture.image);return this.texture.source=new gu(e),this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class Si extends bf{constructor(t=1,e=1,n={}){super(t,e,n),this.isWebGLRenderTarget=!0}}class vu extends Ve{constructor(t=null,e=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=en,this.minFilter=en,this.wrapR=vi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}}class Sf extends Ve{constructor(t=null,e=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=en,this.minFilter=en,this.wrapR=vi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class _e{constructor(t=0,e=0,n=0,s=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=n,this._w=s}static slerpFlat(t,e,n,s,r,o,a){let l=n[s+0],c=n[s+1],h=n[s+2],u=n[s+3];const d=r[o+0],f=r[o+1],g=r[o+2],_=r[o+3];if(a===0){t[e+0]=l,t[e+1]=c,t[e+2]=h,t[e+3]=u;return}if(a===1){t[e+0]=d,t[e+1]=f,t[e+2]=g,t[e+3]=_;return}if(u!==_||l!==d||c!==f||h!==g){let m=1-a;const p=l*d+c*f+h*g+u*_,x=p>=0?1:-1,M=1-p*p;if(M>Number.EPSILON){const A=Math.sqrt(M),E=Math.atan2(A,p*x);m=Math.sin(m*E)/A,a=Math.sin(a*E)/A}const v=a*x;if(l=l*m+d*v,c=c*m+f*v,h=h*m+g*v,u=u*m+_*v,m===1-a){const A=1/Math.sqrt(l*l+c*c+h*h+u*u);l*=A,c*=A,h*=A,u*=A}}t[e]=l,t[e+1]=c,t[e+2]=h,t[e+3]=u}static multiplyQuaternionsFlat(t,e,n,s,r,o){const a=n[s],l=n[s+1],c=n[s+2],h=n[s+3],u=r[o],d=r[o+1],f=r[o+2],g=r[o+3];return t[e]=a*g+h*u+l*f-c*d,t[e+1]=l*g+h*d+c*u-a*f,t[e+2]=c*g+h*f+a*d-l*u,t[e+3]=h*g-a*u-l*d-c*f,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,n,s){return this._x=t,this._y=e,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){const n=t._x,s=t._y,r=t._z,o=t._order,a=Math.cos,l=Math.sin,c=a(n/2),h=a(s/2),u=a(r/2),d=l(n/2),f=l(s/2),g=l(r/2);switch(o){case"XYZ":this._x=d*h*u+c*f*g,this._y=c*f*u-d*h*g,this._z=c*h*g+d*f*u,this._w=c*h*u-d*f*g;break;case"YXZ":this._x=d*h*u+c*f*g,this._y=c*f*u-d*h*g,this._z=c*h*g-d*f*u,this._w=c*h*u+d*f*g;break;case"ZXY":this._x=d*h*u-c*f*g,this._y=c*f*u+d*h*g,this._z=c*h*g+d*f*u,this._w=c*h*u-d*f*g;break;case"ZYX":this._x=d*h*u-c*f*g,this._y=c*f*u+d*h*g,this._z=c*h*g-d*f*u,this._w=c*h*u+d*f*g;break;case"YZX":this._x=d*h*u+c*f*g,this._y=c*f*u+d*h*g,this._z=c*h*g-d*f*u,this._w=c*h*u-d*f*g;break;case"XZY":this._x=d*h*u-c*f*g,this._y=c*f*u-d*h*g,this._z=c*h*g+d*f*u,this._w=c*h*u+d*f*g;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+o)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){const n=e/2,s=Math.sin(n);return this._x=t.x*s,this._y=t.y*s,this._z=t.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(t){const e=t.elements,n=e[0],s=e[4],r=e[8],o=e[1],a=e[5],l=e[9],c=e[2],h=e[6],u=e[10],d=n+a+u;if(d>0){const f=.5/Math.sqrt(d+1);this._w=.25/f,this._x=(h-l)*f,this._y=(r-c)*f,this._z=(o-s)*f}else if(n>a&&n>u){const f=2*Math.sqrt(1+n-a-u);this._w=(h-l)/f,this._x=.25*f,this._y=(s+o)/f,this._z=(r+c)/f}else if(a>u){const f=2*Math.sqrt(1+a-n-u);this._w=(r-c)/f,this._x=(s+o)/f,this._y=.25*f,this._z=(l+h)/f}else{const f=2*Math.sqrt(1+u-n-a);this._w=(o-s)/f,this._x=(r+c)/f,this._y=(l+h)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let n=t.dot(e)+1;return n<Number.EPSILON?(n=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=n):(this._x=0,this._y=-t.z,this._z=t.y,this._w=n)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=n),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(be(this.dot(t),-1,1)))}rotateTowards(t,e){const n=this.angleTo(t);if(n===0)return this;const s=Math.min(1,e/n);return this.slerp(t,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){const n=t._x,s=t._y,r=t._z,o=t._w,a=e._x,l=e._y,c=e._z,h=e._w;return this._x=n*h+o*a+s*c-r*l,this._y=s*h+o*l+r*a-n*c,this._z=r*h+o*c+n*l-s*a,this._w=o*h-n*a-s*l-r*c,this._onChangeCallback(),this}slerp(t,e){if(e===0)return this;if(e===1)return this.copy(t);const n=this._x,s=this._y,r=this._z,o=this._w;let a=o*t._w+n*t._x+s*t._y+r*t._z;if(a<0?(this._w=-t._w,this._x=-t._x,this._y=-t._y,this._z=-t._z,a=-a):this.copy(t),a>=1)return this._w=o,this._x=n,this._y=s,this._z=r,this;const l=1-a*a;if(l<=Number.EPSILON){const f=1-e;return this._w=f*o+e*this._w,this._x=f*n+e*this._x,this._y=f*s+e*this._y,this._z=f*r+e*this._z,this.normalize(),this}const c=Math.sqrt(l),h=Math.atan2(c,a),u=Math.sin((1-e)*h)/c,d=Math.sin(e*h)/c;return this._w=o*u+this._w*d,this._x=n*u+this._x*d,this._y=s*u+this._y*d,this._z=r*u+this._z*d,this._onChangeCallback(),this}slerpQuaternions(t,e,n){return this.copy(t).slerp(e,n)}random(){const t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(s*Math.sin(t),s*Math.cos(t),r*Math.sin(e),r*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class T{constructor(t=0,e=0,n=0){T.prototype.isVector3=!0,this.x=t,this.y=e,this.z=n}set(t,e,n){return n===void 0&&(n=this.z),this.x=t,this.y=e,this.z=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(dc.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(dc.setFromAxisAngle(t,e))}applyMatrix3(t){const e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[3]*n+r[6]*s,this.y=r[1]*e+r[4]*n+r[7]*s,this.z=r[2]*e+r[5]*n+r[8]*s,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){const e=this.x,n=this.y,s=this.z,r=t.elements,o=1/(r[3]*e+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*e+r[4]*n+r[8]*s+r[12])*o,this.y=(r[1]*e+r[5]*n+r[9]*s+r[13])*o,this.z=(r[2]*e+r[6]*n+r[10]*s+r[14])*o,this}applyQuaternion(t){const e=this.x,n=this.y,s=this.z,r=t.x,o=t.y,a=t.z,l=t.w,c=2*(o*s-a*n),h=2*(a*e-r*s),u=2*(r*n-o*e);return this.x=e+l*c+o*u-a*h,this.y=n+l*h+a*c-r*u,this.z=s+l*u+r*h-o*c,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){const e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[4]*n+r[8]*s,this.y=r[1]*e+r[5]*n+r[9]*s,this.z=r[2]*e+r[6]*n+r[10]*s,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){const n=t.x,s=t.y,r=t.z,o=e.x,a=e.y,l=e.z;return this.x=s*l-r*a,this.y=r*o-n*l,this.z=n*a-s*o,this}projectOnVector(t){const e=t.lengthSq();if(e===0)return this.set(0,0,0);const n=t.dot(this)/e;return this.copy(t).multiplyScalar(n)}projectOnPlane(t){return Lo.copy(this).projectOnVector(t),this.sub(Lo)}reflect(t){return this.sub(Lo.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const n=this.dot(t)/e;return Math.acos(be(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,n=this.y-t.y,s=this.z-t.z;return e*e+n*n+s*s}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,n){const s=Math.sin(e)*t;return this.x=s*Math.sin(n),this.y=Math.cos(e)*t,this.z=s*Math.cos(n),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,n){return this.x=t*Math.sin(e),this.y=n,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){const e=this.setFromMatrixColumn(t,0).length(),n=this.setFromMatrixColumn(t,1).length(),s=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=n,this.z=s,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const t=Math.random()*Math.PI*2,e=Math.random()*2-1,n=Math.sqrt(1-e*e);return this.x=n*Math.cos(t),this.y=e,this.z=n*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const Lo=new T,dc=new _e;class Ai{constructor(t=new T(1/0,1/0,1/0),e=new T(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e+=3)this.expandByPoint(un.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,n=t.count;e<n;e++)this.expandByPoint(un.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){const n=un.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(n),this.max.copy(t).add(n),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);const n=t.geometry;if(n!==void 0){const r=n.getAttribute("position");if(e===!0&&r!==void 0&&t.isInstancedMesh!==!0)for(let o=0,a=r.count;o<a;o++)t.isMesh===!0?t.getVertexPosition(o,un):un.fromBufferAttribute(r,o),un.applyMatrix4(t.matrixWorld),this.expandByPoint(un);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),ur.copy(t.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),ur.copy(n.boundingBox)),ur.applyMatrix4(t.matrixWorld),this.union(ur)}const s=t.children;for(let r=0,o=s.length;r<o;r++)this.expandByObject(s[r],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,un),un.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,n;return t.normal.x>0?(e=t.normal.x*this.min.x,n=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,n=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,n+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,n+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,n+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,n+=t.normal.z*this.min.z),e<=-t.constant&&n>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(ms),dr.subVectors(this.max,ms),Ii.subVectors(t.a,ms),Di.subVectors(t.b,ms),Ui.subVectors(t.c,ms),zn.subVectors(Di,Ii),Hn.subVectors(Ui,Di),ai.subVectors(Ii,Ui);let e=[0,-zn.z,zn.y,0,-Hn.z,Hn.y,0,-ai.z,ai.y,zn.z,0,-zn.x,Hn.z,0,-Hn.x,ai.z,0,-ai.x,-zn.y,zn.x,0,-Hn.y,Hn.x,0,-ai.y,ai.x,0];return!Io(e,Ii,Di,Ui,dr)||(e=[1,0,0,0,1,0,0,0,1],!Io(e,Ii,Di,Ui,dr))?!1:(fr.crossVectors(zn,Hn),e=[fr.x,fr.y,fr.z],Io(e,Ii,Di,Ui,dr))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,un).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(un).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(An[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),An[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),An[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),An[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),An[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),An[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),An[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),An[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(An),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}}const An=[new T,new T,new T,new T,new T,new T,new T,new T],un=new T,ur=new Ai,Ii=new T,Di=new T,Ui=new T,zn=new T,Hn=new T,ai=new T,ms=new T,dr=new T,fr=new T,li=new T;function Io(i,t,e,n,s){for(let r=0,o=i.length-3;r<=o;r+=3){li.fromArray(i,r);const a=s.x*Math.abs(li.x)+s.y*Math.abs(li.y)+s.z*Math.abs(li.z),l=t.dot(li),c=e.dot(li),h=n.dot(li);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>a)return!1}return!0}const wf=new Ai,gs=new T,Do=new T;class si{constructor(t=new T,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){const n=this.center;e!==void 0?n.copy(e):wf.setFromPoints(t).getCenter(n);let s=0;for(let r=0,o=t.length;r<o;r++)s=Math.max(s,n.distanceToSquared(t[r]));return this.radius=Math.sqrt(s),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){const e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){const n=this.center.distanceToSquared(t);return e.copy(t),n>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;gs.subVectors(t,this.center);const e=gs.lengthSq();if(e>this.radius*this.radius){const n=Math.sqrt(e),s=(n-this.radius)*.5;this.center.addScaledVector(gs,s/n),this.radius+=s}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(Do.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(gs.copy(t.center).add(Do)),this.expandByPoint(gs.copy(t.center).sub(Do))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}}const Cn=new T,Uo=new T,pr=new T,Vn=new T,No=new T,mr=new T,Oo=new T;class mo{constructor(t=new T,e=new T(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,Cn)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);const n=e.dot(this.direction);return n<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){const e=Cn.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(Cn.copy(this.origin).addScaledVector(this.direction,e),Cn.distanceToSquared(t))}distanceSqToSegment(t,e,n,s){Uo.copy(t).add(e).multiplyScalar(.5),pr.copy(e).sub(t).normalize(),Vn.copy(this.origin).sub(Uo);const r=t.distanceTo(e)*.5,o=-this.direction.dot(pr),a=Vn.dot(this.direction),l=-Vn.dot(pr),c=Vn.lengthSq(),h=Math.abs(1-o*o);let u,d,f,g;if(h>0)if(u=o*l-a,d=o*a-l,g=r*h,u>=0)if(d>=-g)if(d<=g){const _=1/h;u*=_,d*=_,f=u*(u+o*d+2*a)+d*(o*u+d+2*l)+c}else d=r,u=Math.max(0,-(o*d+a)),f=-u*u+d*(d+2*l)+c;else d=-r,u=Math.max(0,-(o*d+a)),f=-u*u+d*(d+2*l)+c;else d<=-g?(u=Math.max(0,-(-o*r+a)),d=u>0?-r:Math.min(Math.max(-r,-l),r),f=-u*u+d*(d+2*l)+c):d<=g?(u=0,d=Math.min(Math.max(-r,-l),r),f=d*(d+2*l)+c):(u=Math.max(0,-(o*r+a)),d=u>0?r:Math.min(Math.max(-r,-l),r),f=-u*u+d*(d+2*l)+c);else d=o>0?-r:r,u=Math.max(0,-(o*d+a)),f=-u*u+d*(d+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,u),s&&s.copy(Uo).addScaledVector(pr,d),f}intersectSphere(t,e){Cn.subVectors(t.center,this.origin);const n=Cn.dot(this.direction),s=Cn.dot(Cn)-n*n,r=t.radius*t.radius;if(s>r)return null;const o=Math.sqrt(r-s),a=n-o,l=n+o;return l<0?null:a<0?this.at(l,e):this.at(a,e)}intersectsSphere(t){return this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){const e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(t.normal)+t.constant)/e;return n>=0?n:null}intersectPlane(t,e){const n=this.distanceToPlane(t);return n===null?null:this.at(n,e)}intersectsPlane(t){const e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let n,s,r,o,a,l;const c=1/this.direction.x,h=1/this.direction.y,u=1/this.direction.z,d=this.origin;return c>=0?(n=(t.min.x-d.x)*c,s=(t.max.x-d.x)*c):(n=(t.max.x-d.x)*c,s=(t.min.x-d.x)*c),h>=0?(r=(t.min.y-d.y)*h,o=(t.max.y-d.y)*h):(r=(t.max.y-d.y)*h,o=(t.min.y-d.y)*h),n>o||r>s||((r>n||isNaN(n))&&(n=r),(o<s||isNaN(s))&&(s=o),u>=0?(a=(t.min.z-d.z)*u,l=(t.max.z-d.z)*u):(a=(t.max.z-d.z)*u,l=(t.min.z-d.z)*u),n>l||a>s)||((a>n||n!==n)&&(n=a),(l<s||s!==s)&&(s=l),s<0)?null:this.at(n>=0?n:s,e)}intersectsBox(t){return this.intersectBox(t,Cn)!==null}intersectTriangle(t,e,n,s,r){No.subVectors(e,t),mr.subVectors(n,t),Oo.crossVectors(No,mr);let o=this.direction.dot(Oo),a;if(o>0){if(s)return null;a=1}else if(o<0)a=-1,o=-o;else return null;Vn.subVectors(this.origin,t);const l=a*this.direction.dot(mr.crossVectors(Vn,mr));if(l<0)return null;const c=a*this.direction.dot(No.cross(Vn));if(c<0||l+c>o)return null;const h=-a*Vn.dot(Oo);return h<0?null:this.at(h/o,r)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class Jt{constructor(t,e,n,s,r,o,a,l,c,h,u,d,f,g,_,m){Jt.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,o,a,l,c,h,u,d,f,g,_,m)}set(t,e,n,s,r,o,a,l,c,h,u,d,f,g,_,m){const p=this.elements;return p[0]=t,p[4]=e,p[8]=n,p[12]=s,p[1]=r,p[5]=o,p[9]=a,p[13]=l,p[2]=c,p[6]=h,p[10]=u,p[14]=d,p[3]=f,p[7]=g,p[11]=_,p[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new Jt().fromArray(this.elements)}copy(t){const e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],e[9]=n[9],e[10]=n[10],e[11]=n[11],e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15],this}copyPosition(t){const e=this.elements,n=t.elements;return e[12]=n[12],e[13]=n[13],e[14]=n[14],this}setFromMatrix3(t){const e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,n){return t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(t,e,n){return this.set(t.x,e.x,n.x,0,t.y,e.y,n.y,0,t.z,e.z,n.z,0,0,0,0,1),this}extractRotation(t){const e=this.elements,n=t.elements,s=1/Ni.setFromMatrixColumn(t,0).length(),r=1/Ni.setFromMatrixColumn(t,1).length(),o=1/Ni.setFromMatrixColumn(t,2).length();return e[0]=n[0]*s,e[1]=n[1]*s,e[2]=n[2]*s,e[3]=0,e[4]=n[4]*r,e[5]=n[5]*r,e[6]=n[6]*r,e[7]=0,e[8]=n[8]*o,e[9]=n[9]*o,e[10]=n[10]*o,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){const e=this.elements,n=t.x,s=t.y,r=t.z,o=Math.cos(n),a=Math.sin(n),l=Math.cos(s),c=Math.sin(s),h=Math.cos(r),u=Math.sin(r);if(t.order==="XYZ"){const d=o*h,f=o*u,g=a*h,_=a*u;e[0]=l*h,e[4]=-l*u,e[8]=c,e[1]=f+g*c,e[5]=d-_*c,e[9]=-a*l,e[2]=_-d*c,e[6]=g+f*c,e[10]=o*l}else if(t.order==="YXZ"){const d=l*h,f=l*u,g=c*h,_=c*u;e[0]=d+_*a,e[4]=g*a-f,e[8]=o*c,e[1]=o*u,e[5]=o*h,e[9]=-a,e[2]=f*a-g,e[6]=_+d*a,e[10]=o*l}else if(t.order==="ZXY"){const d=l*h,f=l*u,g=c*h,_=c*u;e[0]=d-_*a,e[4]=-o*u,e[8]=g+f*a,e[1]=f+g*a,e[5]=o*h,e[9]=_-d*a,e[2]=-o*c,e[6]=a,e[10]=o*l}else if(t.order==="ZYX"){const d=o*h,f=o*u,g=a*h,_=a*u;e[0]=l*h,e[4]=g*c-f,e[8]=d*c+_,e[1]=l*u,e[5]=_*c+d,e[9]=f*c-g,e[2]=-c,e[6]=a*l,e[10]=o*l}else if(t.order==="YZX"){const d=o*l,f=o*c,g=a*l,_=a*c;e[0]=l*h,e[4]=_-d*u,e[8]=g*u+f,e[1]=u,e[5]=o*h,e[9]=-a*h,e[2]=-c*h,e[6]=f*u+g,e[10]=d-_*u}else if(t.order==="XZY"){const d=o*l,f=o*c,g=a*l,_=a*c;e[0]=l*h,e[4]=-u,e[8]=c*h,e[1]=d*u+_,e[5]=o*h,e[9]=f*u-g,e[2]=g*u-f,e[6]=a*h,e[10]=_*u+d}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(Ef,t,Tf)}lookAt(t,e,n){const s=this.elements;return Ze.subVectors(t,e),Ze.lengthSq()===0&&(Ze.z=1),Ze.normalize(),Gn.crossVectors(n,Ze),Gn.lengthSq()===0&&(Math.abs(n.z)===1?Ze.x+=1e-4:Ze.z+=1e-4,Ze.normalize(),Gn.crossVectors(n,Ze)),Gn.normalize(),gr.crossVectors(Ze,Gn),s[0]=Gn.x,s[4]=gr.x,s[8]=Ze.x,s[1]=Gn.y,s[5]=gr.y,s[9]=Ze.y,s[2]=Gn.z,s[6]=gr.z,s[10]=Ze.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const n=t.elements,s=e.elements,r=this.elements,o=n[0],a=n[4],l=n[8],c=n[12],h=n[1],u=n[5],d=n[9],f=n[13],g=n[2],_=n[6],m=n[10],p=n[14],x=n[3],M=n[7],v=n[11],A=n[15],E=s[0],R=s[4],P=s[8],b=s[12],y=s[1],I=s[5],F=s[9],U=s[13],O=s[2],V=s[6],G=s[10],D=s[14],N=s[3],j=s[7],it=s[11],ut=s[15];return r[0]=o*E+a*y+l*O+c*N,r[4]=o*R+a*I+l*V+c*j,r[8]=o*P+a*F+l*G+c*it,r[12]=o*b+a*U+l*D+c*ut,r[1]=h*E+u*y+d*O+f*N,r[5]=h*R+u*I+d*V+f*j,r[9]=h*P+u*F+d*G+f*it,r[13]=h*b+u*U+d*D+f*ut,r[2]=g*E+_*y+m*O+p*N,r[6]=g*R+_*I+m*V+p*j,r[10]=g*P+_*F+m*G+p*it,r[14]=g*b+_*U+m*D+p*ut,r[3]=x*E+M*y+v*O+A*N,r[7]=x*R+M*I+v*V+A*j,r[11]=x*P+M*F+v*G+A*it,r[15]=x*b+M*U+v*D+A*ut,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){const t=this.elements,e=t[0],n=t[4],s=t[8],r=t[12],o=t[1],a=t[5],l=t[9],c=t[13],h=t[2],u=t[6],d=t[10],f=t[14],g=t[3],_=t[7],m=t[11],p=t[15];return g*(+r*l*u-s*c*u-r*a*d+n*c*d+s*a*f-n*l*f)+_*(+e*l*f-e*c*d+r*o*d-s*o*f+s*c*h-r*l*h)+m*(+e*c*u-e*a*f-r*o*u+n*o*f+r*a*h-n*c*h)+p*(-s*a*h-e*l*u+e*a*d+s*o*u-n*o*d+n*l*h)}transpose(){const t=this.elements;let e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,n){const s=this.elements;return t.isVector3?(s[12]=t.x,s[13]=t.y,s[14]=t.z):(s[12]=t,s[13]=e,s[14]=n),this}invert(){const t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],o=t[4],a=t[5],l=t[6],c=t[7],h=t[8],u=t[9],d=t[10],f=t[11],g=t[12],_=t[13],m=t[14],p=t[15],x=u*m*c-_*d*c+_*l*f-a*m*f-u*l*p+a*d*p,M=g*d*c-h*m*c-g*l*f+o*m*f+h*l*p-o*d*p,v=h*_*c-g*u*c+g*a*f-o*_*f-h*a*p+o*u*p,A=g*u*l-h*_*l-g*a*d+o*_*d+h*a*m-o*u*m,E=e*x+n*M+s*v+r*A;if(E===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const R=1/E;return t[0]=x*R,t[1]=(_*d*r-u*m*r-_*s*f+n*m*f+u*s*p-n*d*p)*R,t[2]=(a*m*r-_*l*r+_*s*c-n*m*c-a*s*p+n*l*p)*R,t[3]=(u*l*r-a*d*r-u*s*c+n*d*c+a*s*f-n*l*f)*R,t[4]=M*R,t[5]=(h*m*r-g*d*r+g*s*f-e*m*f-h*s*p+e*d*p)*R,t[6]=(g*l*r-o*m*r-g*s*c+e*m*c+o*s*p-e*l*p)*R,t[7]=(o*d*r-h*l*r+h*s*c-e*d*c-o*s*f+e*l*f)*R,t[8]=v*R,t[9]=(g*u*r-h*_*r-g*n*f+e*_*f+h*n*p-e*u*p)*R,t[10]=(o*_*r-g*a*r+g*n*c-e*_*c-o*n*p+e*a*p)*R,t[11]=(h*a*r-o*u*r-h*n*c+e*u*c+o*n*f-e*a*f)*R,t[12]=A*R,t[13]=(h*_*s-g*u*s+g*n*d-e*_*d-h*n*m+e*u*m)*R,t[14]=(g*a*s-o*_*s-g*n*l+e*_*l+o*n*m-e*a*m)*R,t[15]=(o*u*s-h*a*s+h*n*l-e*u*l-o*n*d+e*a*d)*R,this}scale(t){const e=this.elements,n=t.x,s=t.y,r=t.z;return e[0]*=n,e[4]*=s,e[8]*=r,e[1]*=n,e[5]*=s,e[9]*=r,e[2]*=n,e[6]*=s,e[10]*=r,e[3]*=n,e[7]*=s,e[11]*=r,this}getMaxScaleOnAxis(){const t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],n=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],s=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,n,s))}makeTranslation(t,e,n){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,n,0,0,0,1),this}makeRotationX(t){const e=Math.cos(t),n=Math.sin(t);return this.set(1,0,0,0,0,e,-n,0,0,n,e,0,0,0,0,1),this}makeRotationY(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,0,n,0,0,1,0,0,-n,0,e,0,0,0,0,1),this}makeRotationZ(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,0,n,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){const n=Math.cos(e),s=Math.sin(e),r=1-n,o=t.x,a=t.y,l=t.z,c=r*o,h=r*a;return this.set(c*o+n,c*a-s*l,c*l+s*a,0,c*a+s*l,h*a+n,h*l-s*o,0,c*l-s*a,h*l+s*o,r*l*l+n,0,0,0,0,1),this}makeScale(t,e,n){return this.set(t,0,0,0,0,e,0,0,0,0,n,0,0,0,0,1),this}makeShear(t,e,n,s,r,o){return this.set(1,n,r,0,t,1,o,0,e,s,1,0,0,0,0,1),this}compose(t,e,n){const s=this.elements,r=e._x,o=e._y,a=e._z,l=e._w,c=r+r,h=o+o,u=a+a,d=r*c,f=r*h,g=r*u,_=o*h,m=o*u,p=a*u,x=l*c,M=l*h,v=l*u,A=n.x,E=n.y,R=n.z;return s[0]=(1-(_+p))*A,s[1]=(f+v)*A,s[2]=(g-M)*A,s[3]=0,s[4]=(f-v)*E,s[5]=(1-(d+p))*E,s[6]=(m+x)*E,s[7]=0,s[8]=(g+M)*R,s[9]=(m-x)*R,s[10]=(1-(d+_))*R,s[11]=0,s[12]=t.x,s[13]=t.y,s[14]=t.z,s[15]=1,this}decompose(t,e,n){const s=this.elements;let r=Ni.set(s[0],s[1],s[2]).length();const o=Ni.set(s[4],s[5],s[6]).length(),a=Ni.set(s[8],s[9],s[10]).length();this.determinant()<0&&(r=-r),t.x=s[12],t.y=s[13],t.z=s[14],dn.copy(this);const c=1/r,h=1/o,u=1/a;return dn.elements[0]*=c,dn.elements[1]*=c,dn.elements[2]*=c,dn.elements[4]*=h,dn.elements[5]*=h,dn.elements[6]*=h,dn.elements[8]*=u,dn.elements[9]*=u,dn.elements[10]*=u,e.setFromRotationMatrix(dn),n.x=r,n.y=o,n.z=a,this}makePerspective(t,e,n,s,r,o,a=Un){const l=this.elements,c=2*r/(e-t),h=2*r/(n-s),u=(e+t)/(e-t),d=(n+s)/(n-s);let f,g;if(a===Un)f=-(o+r)/(o-r),g=-2*o*r/(o-r);else if(a===io)f=-o/(o-r),g=-o*r/(o-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return l[0]=c,l[4]=0,l[8]=u,l[12]=0,l[1]=0,l[5]=h,l[9]=d,l[13]=0,l[2]=0,l[6]=0,l[10]=f,l[14]=g,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(t,e,n,s,r,o,a=Un){const l=this.elements,c=1/(e-t),h=1/(n-s),u=1/(o-r),d=(e+t)*c,f=(n+s)*h;let g,_;if(a===Un)g=(o+r)*u,_=-2*u;else if(a===io)g=r*u,_=-1*u;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return l[0]=2*c,l[4]=0,l[8]=0,l[12]=-d,l[1]=0,l[5]=2*h,l[9]=0,l[13]=-f,l[2]=0,l[6]=0,l[10]=_,l[14]=-g,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(t){const e=this.elements,n=t.elements;for(let s=0;s<16;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<16;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){const n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t[e+9]=n[9],t[e+10]=n[10],t[e+11]=n[11],t[e+12]=n[12],t[e+13]=n[13],t[e+14]=n[14],t[e+15]=n[15],t}}const Ni=new T,dn=new Jt,Ef=new T(0,0,0),Tf=new T(1,1,1),Gn=new T,gr=new T,Ze=new T,fc=new Jt,pc=new _e;class ln{constructor(t=0,e=0,n=0,s=ln.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=n,this._order=s}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,n,s=this._order){return this._x=t,this._y=e,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,n=!0){const s=t.elements,r=s[0],o=s[4],a=s[8],l=s[1],c=s[5],h=s[9],u=s[2],d=s[6],f=s[10];switch(e){case"XYZ":this._y=Math.asin(be(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-h,f),this._z=Math.atan2(-o,r)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-be(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(a,f),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-u,r),this._z=0);break;case"ZXY":this._x=Math.asin(be(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,f),this._z=Math.atan2(-o,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-be(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,f),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-o,c));break;case"YZX":this._z=Math.asin(be(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-u,r)):(this._x=0,this._y=Math.atan2(a,f));break;case"XZY":this._z=Math.asin(-be(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(a,r)):(this._x=Math.atan2(-h,f),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,n===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,n){return fc.makeRotationFromQuaternion(t),this.setFromRotationMatrix(fc,e,n)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return pc.setFromEuler(this),this.setFromQuaternion(pc,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}ln.DEFAULT_ORDER="XYZ";class Dl{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}}let Af=0;const mc=new T,Oi=new _e,Rn=new Jt,vr=new T,vs=new T,Cf=new T,Rf=new _e,gc=new T(1,0,0),vc=new T(0,1,0),_c=new T(0,0,1),Mc={type:"added"},Pf={type:"removed"},Fi={type:"childadded",child:null},Fo={type:"childremoved",child:null};class Pe extends Ei{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Af++}),this.uuid=Ti(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=Pe.DEFAULT_UP.clone();const t=new T,e=new ln,n=new _e,s=new T(1,1,1);function r(){n.setFromEuler(e,!1)}function o(){e.setFromQuaternion(n,void 0,!1)}e._onChange(r),n._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new Jt},normalMatrix:{value:new qt}}),this.matrix=new Jt,this.matrixWorld=new Jt,this.matrixAutoUpdate=Pe.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=Pe.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Dl,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return Oi.setFromAxisAngle(t,e),this.quaternion.multiply(Oi),this}rotateOnWorldAxis(t,e){return Oi.setFromAxisAngle(t,e),this.quaternion.premultiply(Oi),this}rotateX(t){return this.rotateOnAxis(gc,t)}rotateY(t){return this.rotateOnAxis(vc,t)}rotateZ(t){return this.rotateOnAxis(_c,t)}translateOnAxis(t,e){return mc.copy(t).applyQuaternion(this.quaternion),this.position.add(mc.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(gc,t)}translateY(t){return this.translateOnAxis(vc,t)}translateZ(t){return this.translateOnAxis(_c,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(Rn.copy(this.matrixWorld).invert())}lookAt(t,e,n){t.isVector3?vr.copy(t):vr.set(t,e,n);const s=this.parent;this.updateWorldMatrix(!0,!1),vs.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Rn.lookAt(vs,vr,this.up):Rn.lookAt(vr,vs,this.up),this.quaternion.setFromRotationMatrix(Rn),s&&(Rn.extractRotation(s.matrixWorld),Oi.setFromRotationMatrix(Rn),this.quaternion.premultiply(Oi.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(Mc),Fi.child=t,this.dispatchEvent(Fi),Fi.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(Pf),Fo.child=t,this.dispatchEvent(Fo),Fo.child=null),this}removeFromParent(){const t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),Rn.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),Rn.multiply(t.parent.matrixWorld)),t.applyMatrix4(Rn),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(Mc),Fi.child=t,this.dispatchEvent(Fi),Fi.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let n=0,s=this.children.length;n<s;n++){const o=this.children[n].getObjectByProperty(t,e);if(o!==void 0)return o}}getObjectsByProperty(t,e,n=[]){this[t]===e&&n.push(this);const s=this.children;for(let r=0,o=s.length;r<o;r++)s[r].getObjectsByProperty(t,e,n);return n}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(vs,t,Cf),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(vs,Rf,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);const e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}traverse(t){t(this);const e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);const e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverseVisible(t)}traverseAncestors(t){const e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);const e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].updateMatrixWorld(t)}updateWorldMatrix(t,e){const n=this.parent;if(t===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),e===!0){const s=this.children;for(let r=0,o=s.length;r<o;r++)s[r].updateWorldMatrix(!1,!0)}}toJSON(t){const e=t===void 0||typeof t=="string",n={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});const s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.visibility=this._visibility,s.active=this._active,s.bounds=this._bounds.map(a=>({boxInitialized:a.boxInitialized,boxMin:a.box.min.toArray(),boxMax:a.box.max.toArray(),sphereInitialized:a.sphereInitialized,sphereRadius:a.sphere.radius,sphereCenter:a.sphere.center.toArray()})),s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.geometryCount=this._geometryCount,s.matricesTexture=this._matricesTexture.toJSON(t),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(s.boundingSphere={center:s.boundingSphere.center.toArray(),radius:s.boundingSphere.radius}),this.boundingBox!==null&&(s.boundingBox={min:s.boundingBox.min.toArray(),max:s.boundingBox.max.toArray()}));function r(a,l){return a[l.uuid]===void 0&&(a[l.uuid]=l.toJSON(t)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(t.geometries,this.geometry);const a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){const l=a.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){const u=l[c];r(t.shapes,u)}else r(t.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(t.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const a=[];for(let l=0,c=this.material.length;l<c;l++)a.push(r(t.materials,this.material[l]));s.material=a}else s.material=r(t.materials,this.material);if(this.children.length>0){s.children=[];for(let a=0;a<this.children.length;a++)s.children.push(this.children[a].toJSON(t).object)}if(this.animations.length>0){s.animations=[];for(let a=0;a<this.animations.length;a++){const l=this.animations[a];s.animations.push(r(t.animations,l))}}if(e){const a=o(t.geometries),l=o(t.materials),c=o(t.textures),h=o(t.images),u=o(t.shapes),d=o(t.skeletons),f=o(t.animations),g=o(t.nodes);a.length>0&&(n.geometries=a),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),u.length>0&&(n.shapes=u),d.length>0&&(n.skeletons=d),f.length>0&&(n.animations=f),g.length>0&&(n.nodes=g)}return n.object=s,n;function o(a){const l=[];for(const c in a){const h=a[c];delete h.metadata,l.push(h)}return l}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let n=0;n<t.children.length;n++){const s=t.children[n];this.add(s.clone())}return this}}Pe.DEFAULT_UP=new T(0,1,0);Pe.DEFAULT_MATRIX_AUTO_UPDATE=!0;Pe.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const fn=new T,Pn=new T,Bo=new T,Ln=new T,Bi=new T,ki=new T,xc=new T,ko=new T,zo=new T,Ho=new T,Vo=new ie,Go=new ie,Wo=new ie;class pn{constructor(t=new T,e=new T,n=new T){this.a=t,this.b=e,this.c=n}static getNormal(t,e,n,s){s.subVectors(n,e),fn.subVectors(t,e),s.cross(fn);const r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(t,e,n,s,r){fn.subVectors(s,e),Pn.subVectors(n,e),Bo.subVectors(t,e);const o=fn.dot(fn),a=fn.dot(Pn),l=fn.dot(Bo),c=Pn.dot(Pn),h=Pn.dot(Bo),u=o*c-a*a;if(u===0)return r.set(0,0,0),null;const d=1/u,f=(c*l-a*h)*d,g=(o*h-a*l)*d;return r.set(1-f-g,g,f)}static containsPoint(t,e,n,s){return this.getBarycoord(t,e,n,s,Ln)===null?!1:Ln.x>=0&&Ln.y>=0&&Ln.x+Ln.y<=1}static getInterpolation(t,e,n,s,r,o,a,l){return this.getBarycoord(t,e,n,s,Ln)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,Ln.x),l.addScaledVector(o,Ln.y),l.addScaledVector(a,Ln.z),l)}static getInterpolatedAttribute(t,e,n,s,r,o){return Vo.setScalar(0),Go.setScalar(0),Wo.setScalar(0),Vo.fromBufferAttribute(t,e),Go.fromBufferAttribute(t,n),Wo.fromBufferAttribute(t,s),o.setScalar(0),o.addScaledVector(Vo,r.x),o.addScaledVector(Go,r.y),o.addScaledVector(Wo,r.z),o}static isFrontFacing(t,e,n,s){return fn.subVectors(n,e),Pn.subVectors(t,e),fn.cross(Pn).dot(s)<0}set(t,e,n){return this.a.copy(t),this.b.copy(e),this.c.copy(n),this}setFromPointsAndIndices(t,e,n,s){return this.a.copy(t[e]),this.b.copy(t[n]),this.c.copy(t[s]),this}setFromAttributeAndIndices(t,e,n,s){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,n),this.c.fromBufferAttribute(t,s),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return fn.subVectors(this.c,this.b),Pn.subVectors(this.a,this.b),fn.cross(Pn).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return pn.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return pn.getBarycoord(t,this.a,this.b,this.c,e)}getInterpolation(t,e,n,s,r){return pn.getInterpolation(t,this.a,this.b,this.c,e,n,s,r)}containsPoint(t){return pn.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return pn.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){const n=this.a,s=this.b,r=this.c;let o,a;Bi.subVectors(s,n),ki.subVectors(r,n),ko.subVectors(t,n);const l=Bi.dot(ko),c=ki.dot(ko);if(l<=0&&c<=0)return e.copy(n);zo.subVectors(t,s);const h=Bi.dot(zo),u=ki.dot(zo);if(h>=0&&u<=h)return e.copy(s);const d=l*u-h*c;if(d<=0&&l>=0&&h<=0)return o=l/(l-h),e.copy(n).addScaledVector(Bi,o);Ho.subVectors(t,r);const f=Bi.dot(Ho),g=ki.dot(Ho);if(g>=0&&f<=g)return e.copy(r);const _=f*c-l*g;if(_<=0&&c>=0&&g<=0)return a=c/(c-g),e.copy(n).addScaledVector(ki,a);const m=h*g-f*u;if(m<=0&&u-h>=0&&f-g>=0)return xc.subVectors(r,s),a=(u-h)/(u-h+(f-g)),e.copy(s).addScaledVector(xc,a);const p=1/(m+_+d);return o=_*p,a=d*p,e.copy(n).addScaledVector(Bi,o).addScaledVector(ki,a)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}}const _u={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Wn={h:0,s:0,l:0},_r={h:0,s:0,l:0};function qo(i,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?i+(t-i)*6*e:e<1/2?t:e<2/3?i+(t-i)*6*(2/3-e):i}class St{constructor(t,e,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,n)}set(t,e,n){if(e===void 0&&n===void 0){const s=t;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(t,e,n);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=we){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,Qt.toWorkingColorSpace(this,e),this}setRGB(t,e,n,s=Qt.workingColorSpace){return this.r=t,this.g=e,this.b=n,Qt.toWorkingColorSpace(this,s),this}setHSL(t,e,n,s=Qt.workingColorSpace){if(t=Ll(t,1),e=be(e,0,1),n=be(n,0,1),e===0)this.r=this.g=this.b=n;else{const r=n<=.5?n*(1+e):n+e-n*e,o=2*n-r;this.r=qo(o,r,t+1/3),this.g=qo(o,r,t),this.b=qo(o,r,t-1/3)}return Qt.toWorkingColorSpace(this,s),this}setStyle(t,e=we){function n(r){r!==void 0&&parseFloat(r)<1&&console.warn("THREE.Color: Alpha component of "+t+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(t)){let r;const o=s[1],a=s[2];switch(o){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,e);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,e);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,e);break;default:console.warn("THREE.Color: Unknown color model "+t)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(t)){const r=s[1],o=r.length;if(o===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,e);if(o===6)return this.setHex(parseInt(r,16),e);console.warn("THREE.Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=we){const n=_u[t.toLowerCase()];return n!==void 0?this.setHex(n,e):console.warn("THREE.Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=Nn(t.r),this.g=Nn(t.g),this.b=Nn(t.b),this}copyLinearToSRGB(t){return this.r=Qi(t.r),this.g=Qi(t.g),this.b=Qi(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=we){return Qt.fromWorkingColorSpace(ke.copy(this),t),Math.round(be(ke.r*255,0,255))*65536+Math.round(be(ke.g*255,0,255))*256+Math.round(be(ke.b*255,0,255))}getHexString(t=we){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=Qt.workingColorSpace){Qt.fromWorkingColorSpace(ke.copy(this),e);const n=ke.r,s=ke.g,r=ke.b,o=Math.max(n,s,r),a=Math.min(n,s,r);let l,c;const h=(a+o)/2;if(a===o)l=0,c=0;else{const u=o-a;switch(c=h<=.5?u/(o+a):u/(2-o-a),o){case n:l=(s-r)/u+(s<r?6:0);break;case s:l=(r-n)/u+2;break;case r:l=(n-s)/u+4;break}l/=6}return t.h=l,t.s=c,t.l=h,t}getRGB(t,e=Qt.workingColorSpace){return Qt.fromWorkingColorSpace(ke.copy(this),e),t.r=ke.r,t.g=ke.g,t.b=ke.b,t}getStyle(t=we){Qt.fromWorkingColorSpace(ke.copy(this),t);const e=ke.r,n=ke.g,s=ke.b;return t!==we?`color(${t} ${e.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(t,e,n){return this.getHSL(Wn),this.setHSL(Wn.h+t,Wn.s+e,Wn.l+n)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,n){return this.r=t.r+(e.r-t.r)*n,this.g=t.g+(e.g-t.g)*n,this.b=t.b+(e.b-t.b)*n,this}lerpHSL(t,e){this.getHSL(Wn),t.getHSL(_r);const n=Us(Wn.h,_r.h,e),s=Us(Wn.s,_r.s,e),r=Us(Wn.l,_r.l,e);return this.setHSL(n,s,r),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){const e=this.r,n=this.g,s=this.b,r=t.elements;return this.r=r[0]*e+r[3]*n+r[6]*s,this.g=r[1]*e+r[4]*n+r[7]*s,this.b=r[2]*e+r[5]*n+r[8]*s,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const ke=new St;St.NAMES=_u;let Lf=0;class cs extends Ei{static get type(){return"Material"}get type(){return this.constructor.type}set type(t){}constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Lf++}),this.uuid=Ti(),this.name="",this.blending=xi,this.side=bn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Pa,this.blendDst=qs,this.blendEquation=_n,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new St(0,0,0),this.blendAlpha=0,this.depthFunc=es,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=nc,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Pi,this.stencilZFail=Pi,this.stencilZPass=Pi,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(const e in t){const n=t[e];if(n===void 0){console.warn(`THREE.Material: parameter '${e}' has value of undefined.`);continue}const s=this[e];if(s===void 0){console.warn(`THREE.Material: '${e}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[e]=n}}toJSON(t){const e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});const n={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(t).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(t).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(t).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(t).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(t).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==xi&&(n.blending=this.blending),this.side!==bn&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==Pa&&(n.blendSrc=this.blendSrc),this.blendDst!==qs&&(n.blendDst=this.blendDst),this.blendEquation!==_n&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==es&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==nc&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Pi&&(n.stencilFail=this.stencilFail),this.stencilZFail!==Pi&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==Pi&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){const o=[];for(const a in r){const l=r[a];delete l.metadata,o.push(l)}return o}if(e){const r=s(t.textures),o=s(t.images);r.length>0&&(n.textures=r),o.length>0&&(n.images=o)}return n}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;const e=t.clippingPlanes;let n=null;if(e!==null){const s=e.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=e[r].clone()}return this.clippingPlanes=n,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}onBuild(){console.warn("Material: onBuild() has been removed.")}}class Sn extends cs{static get type(){return"MeshBasicMaterial"}constructor(t){super(),this.isMeshBasicMaterial=!0,this.color=new St(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new ln,this.combine=eu,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}}const Me=new T,Mr=new H;class Re{constructor(t,e,n=!1){if(Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=n,this.usage=ic,this.updateRanges=[],this.gpuType=xn,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,n){t*=this.itemSize,n*=e.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[t+s]=e.array[n+s];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,n=this.count;e<n;e++)Mr.fromBufferAttribute(this,e),Mr.applyMatrix3(t),this.setXY(e,Mr.x,Mr.y);else if(this.itemSize===3)for(let e=0,n=this.count;e<n;e++)Me.fromBufferAttribute(this,e),Me.applyMatrix3(t),this.setXYZ(e,Me.x,Me.y,Me.z);return this}applyMatrix4(t){for(let e=0,n=this.count;e<n;e++)Me.fromBufferAttribute(this,e),Me.applyMatrix4(t),this.setXYZ(e,Me.x,Me.y,Me.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)Me.fromBufferAttribute(this,e),Me.applyNormalMatrix(t),this.setXYZ(e,Me.x,Me.y,Me.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)Me.fromBufferAttribute(this,e),Me.transformDirection(t),this.setXYZ(e,Me.x,Me.y,Me.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let n=this.array[t*this.itemSize+e];return this.normalized&&(n=Xi(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=Ge(n,this.array)),this.array[t*this.itemSize+e]=n,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=Xi(e,this.array)),e}setX(t,e){return this.normalized&&(e=Ge(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=Xi(e,this.array)),e}setY(t,e){return this.normalized&&(e=Ge(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=Xi(e,this.array)),e}setZ(t,e){return this.normalized&&(e=Ge(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=Xi(e,this.array)),e}setW(t,e){return this.normalized&&(e=Ge(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,n){return t*=this.itemSize,this.normalized&&(e=Ge(e,this.array),n=Ge(n,this.array)),this.array[t+0]=e,this.array[t+1]=n,this}setXYZ(t,e,n,s){return t*=this.itemSize,this.normalized&&(e=Ge(e,this.array),n=Ge(n,this.array),s=Ge(s,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this}setXYZW(t,e,n,s,r){return t*=this.itemSize,this.normalized&&(e=Ge(e,this.array),n=Ge(n,this.array),s=Ge(s,this.array),r=Ge(r,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this.array[t+3]=r,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==ic&&(t.usage=this.usage),t}}class Mu extends Re{constructor(t,e,n){super(new Uint16Array(t),e,n)}}class xu extends Re{constructor(t,e,n){super(new Uint32Array(t),e,n)}}class jt extends Re{constructor(t,e,n){super(new Float32Array(t),e,n)}}let If=0;const on=new Jt,Yo=new Pe,zi=new T,Je=new Ai,_s=new Ai,Ce=new T;class pe extends Ei{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:If++}),this.uuid=Ti(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(mu(t)?xu:Mu)(t,1):this.index=t,this}setIndirect(t){return this.indirect=t,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,n=0){this.groups.push({start:t,count:e,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){const e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const r=new qt().getNormalMatrix(t);n.applyNormalMatrix(r),n.needsUpdate=!0}const s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(t),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(t){return on.makeRotationFromQuaternion(t),this.applyMatrix4(on),this}rotateX(t){return on.makeRotationX(t),this.applyMatrix4(on),this}rotateY(t){return on.makeRotationY(t),this.applyMatrix4(on),this}rotateZ(t){return on.makeRotationZ(t),this.applyMatrix4(on),this}translate(t,e,n){return on.makeTranslation(t,e,n),this.applyMatrix4(on),this}scale(t,e,n){return on.makeScale(t,e,n),this.applyMatrix4(on),this}lookAt(t){return Yo.lookAt(t),Yo.updateMatrix(),this.applyMatrix4(Yo.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(zi).negate(),this.translate(zi.x,zi.y,zi.z),this}setFromPoints(t){const e=this.getAttribute("position");if(e===void 0){const n=[];for(let s=0,r=t.length;s<r;s++){const o=t[s];n.push(o.x,o.y,o.z||0)}this.setAttribute("position",new jt(n,3))}else{for(let n=0,s=e.count;n<s;n++){const r=t[n];e.setXYZ(n,r.x,r.y,r.z||0)}t.length>e.count&&console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),e.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Ai);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new T(-1/0,-1/0,-1/0),new T(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let n=0,s=e.length;n<s;n++){const r=e[n];Je.setFromBufferAttribute(r),this.morphTargetsRelative?(Ce.addVectors(this.boundingBox.min,Je.min),this.boundingBox.expandByPoint(Ce),Ce.addVectors(this.boundingBox.max,Je.max),this.boundingBox.expandByPoint(Ce)):(this.boundingBox.expandByPoint(Je.min),this.boundingBox.expandByPoint(Je.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new si);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new T,1/0);return}if(t){const n=this.boundingSphere.center;if(Je.setFromBufferAttribute(t),e)for(let r=0,o=e.length;r<o;r++){const a=e[r];_s.setFromBufferAttribute(a),this.morphTargetsRelative?(Ce.addVectors(Je.min,_s.min),Je.expandByPoint(Ce),Ce.addVectors(Je.max,_s.max),Je.expandByPoint(Ce)):(Je.expandByPoint(_s.min),Je.expandByPoint(_s.max))}Je.getCenter(n);let s=0;for(let r=0,o=t.count;r<o;r++)Ce.fromBufferAttribute(t,r),s=Math.max(s,n.distanceToSquared(Ce));if(e)for(let r=0,o=e.length;r<o;r++){const a=e[r],l=this.morphTargetsRelative;for(let c=0,h=a.count;c<h;c++)Ce.fromBufferAttribute(a,c),l&&(zi.fromBufferAttribute(t,c),Ce.add(zi)),s=Math.max(s,n.distanceToSquared(Ce))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=e.position,s=e.normal,r=e.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new Re(new Float32Array(4*n.count),4));const o=this.getAttribute("tangent"),a=[],l=[];for(let P=0;P<n.count;P++)a[P]=new T,l[P]=new T;const c=new T,h=new T,u=new T,d=new H,f=new H,g=new H,_=new T,m=new T;function p(P,b,y){c.fromBufferAttribute(n,P),h.fromBufferAttribute(n,b),u.fromBufferAttribute(n,y),d.fromBufferAttribute(r,P),f.fromBufferAttribute(r,b),g.fromBufferAttribute(r,y),h.sub(c),u.sub(c),f.sub(d),g.sub(d);const I=1/(f.x*g.y-g.x*f.y);isFinite(I)&&(_.copy(h).multiplyScalar(g.y).addScaledVector(u,-f.y).multiplyScalar(I),m.copy(u).multiplyScalar(f.x).addScaledVector(h,-g.x).multiplyScalar(I),a[P].add(_),a[b].add(_),a[y].add(_),l[P].add(m),l[b].add(m),l[y].add(m))}let x=this.groups;x.length===0&&(x=[{start:0,count:t.count}]);for(let P=0,b=x.length;P<b;++P){const y=x[P],I=y.start,F=y.count;for(let U=I,O=I+F;U<O;U+=3)p(t.getX(U+0),t.getX(U+1),t.getX(U+2))}const M=new T,v=new T,A=new T,E=new T;function R(P){A.fromBufferAttribute(s,P),E.copy(A);const b=a[P];M.copy(b),M.sub(A.multiplyScalar(A.dot(b))).normalize(),v.crossVectors(E,b);const I=v.dot(l[P])<0?-1:1;o.setXYZW(P,M.x,M.y,M.z,I)}for(let P=0,b=x.length;P<b;++P){const y=x[P],I=y.start,F=y.count;for(let U=I,O=I+F;U<O;U+=3)R(t.getX(U+0)),R(t.getX(U+1)),R(t.getX(U+2))}}computeVertexNormals(){const t=this.index,e=this.getAttribute("position");if(e!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new Re(new Float32Array(e.count*3),3),this.setAttribute("normal",n);else for(let d=0,f=n.count;d<f;d++)n.setXYZ(d,0,0,0);const s=new T,r=new T,o=new T,a=new T,l=new T,c=new T,h=new T,u=new T;if(t)for(let d=0,f=t.count;d<f;d+=3){const g=t.getX(d+0),_=t.getX(d+1),m=t.getX(d+2);s.fromBufferAttribute(e,g),r.fromBufferAttribute(e,_),o.fromBufferAttribute(e,m),h.subVectors(o,r),u.subVectors(s,r),h.cross(u),a.fromBufferAttribute(n,g),l.fromBufferAttribute(n,_),c.fromBufferAttribute(n,m),a.add(h),l.add(h),c.add(h),n.setXYZ(g,a.x,a.y,a.z),n.setXYZ(_,l.x,l.y,l.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let d=0,f=e.count;d<f;d+=3)s.fromBufferAttribute(e,d+0),r.fromBufferAttribute(e,d+1),o.fromBufferAttribute(e,d+2),h.subVectors(o,r),u.subVectors(s,r),h.cross(u),n.setXYZ(d+0,h.x,h.y,h.z),n.setXYZ(d+1,h.x,h.y,h.z),n.setXYZ(d+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const t=this.attributes.normal;for(let e=0,n=t.count;e<n;e++)Ce.fromBufferAttribute(t,e),Ce.normalize(),t.setXYZ(e,Ce.x,Ce.y,Ce.z)}toNonIndexed(){function t(a,l){const c=a.array,h=a.itemSize,u=a.normalized,d=new c.constructor(l.length*h);let f=0,g=0;for(let _=0,m=l.length;_<m;_++){a.isInterleavedBufferAttribute?f=l[_]*a.data.stride+a.offset:f=l[_]*h;for(let p=0;p<h;p++)d[g++]=c[f++]}return new Re(d,h,u)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const e=new pe,n=this.index.array,s=this.attributes;for(const a in s){const l=s[a],c=t(l,n);e.setAttribute(a,c)}const r=this.morphAttributes;for(const a in r){const l=[],c=r[a];for(let h=0,u=c.length;h<u;h++){const d=c[h],f=t(d,n);l.push(f)}e.morphAttributes[a]=l}e.morphTargetsRelative=this.morphTargetsRelative;const o=this.groups;for(let a=0,l=o.length;a<l;a++){const c=o[a];e.addGroup(c.start,c.count,c.materialIndex)}return e}toJSON(){const t={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(t[c]=l[c]);return t}t.data={attributes:{}};const e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});const n=this.attributes;for(const l in n){const c=n[l];t.data.attributes[l]=c.toJSON(t.data)}const s={};let r=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],h=[];for(let u=0,d=c.length;u<d;u++){const f=c[u];h.push(f.toJSON(t.data))}h.length>0&&(s[l]=h,r=!0)}r&&(t.data.morphAttributes=s,t.data.morphTargetsRelative=this.morphTargetsRelative);const o=this.groups;o.length>0&&(t.data.groups=JSON.parse(JSON.stringify(o)));const a=this.boundingSphere;return a!==null&&(t.data.boundingSphere={center:a.center.toArray(),radius:a.radius}),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const e={};this.name=t.name;const n=t.index;n!==null&&this.setIndex(n.clone(e));const s=t.attributes;for(const c in s){const h=s[c];this.setAttribute(c,h.clone(e))}const r=t.morphAttributes;for(const c in r){const h=[],u=r[c];for(let d=0,f=u.length;d<f;d++)h.push(u[d].clone(e));this.morphAttributes[c]=h}this.morphTargetsRelative=t.morphTargetsRelative;const o=t.groups;for(let c=0,h=o.length;c<h;c++){const u=o[c];this.addGroup(u.start,u.count,u.materialIndex)}const a=t.boundingBox;a!==null&&(this.boundingBox=a.clone());const l=t.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const yc=new Jt,ci=new mo,xr=new si,bc=new T,yr=new T,br=new T,Sr=new T,Xo=new T,wr=new T,Sc=new T,Er=new T;class J extends Pe{constructor(t=new pe,e=new Sn){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){const a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}getVertexPosition(t,e){const n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,o=n.morphTargetsRelative;e.fromBufferAttribute(s,t);const a=this.morphTargetInfluences;if(r&&a){wr.set(0,0,0);for(let l=0,c=r.length;l<c;l++){const h=a[l],u=r[l];h!==0&&(Xo.fromBufferAttribute(u,t),o?wr.addScaledVector(Xo,h):wr.addScaledVector(Xo.sub(e),h))}e.add(wr)}return e}raycast(t,e){const n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),xr.copy(n.boundingSphere),xr.applyMatrix4(r),ci.copy(t.ray).recast(t.near),!(xr.containsPoint(ci.origin)===!1&&(ci.intersectSphere(xr,bc)===null||ci.origin.distanceToSquared(bc)>(t.far-t.near)**2))&&(yc.copy(r).invert(),ci.copy(t.ray).applyMatrix4(yc),!(n.boundingBox!==null&&ci.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(t,e,ci)))}_computeIntersections(t,e,n){let s;const r=this.geometry,o=this.material,a=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,u=r.attributes.normal,d=r.groups,f=r.drawRange;if(a!==null)if(Array.isArray(o))for(let g=0,_=d.length;g<_;g++){const m=d[g],p=o[m.materialIndex],x=Math.max(m.start,f.start),M=Math.min(a.count,Math.min(m.start+m.count,f.start+f.count));for(let v=x,A=M;v<A;v+=3){const E=a.getX(v),R=a.getX(v+1),P=a.getX(v+2);s=Tr(this,p,t,n,c,h,u,E,R,P),s&&(s.faceIndex=Math.floor(v/3),s.face.materialIndex=m.materialIndex,e.push(s))}}else{const g=Math.max(0,f.start),_=Math.min(a.count,f.start+f.count);for(let m=g,p=_;m<p;m+=3){const x=a.getX(m),M=a.getX(m+1),v=a.getX(m+2);s=Tr(this,o,t,n,c,h,u,x,M,v),s&&(s.faceIndex=Math.floor(m/3),e.push(s))}}else if(l!==void 0)if(Array.isArray(o))for(let g=0,_=d.length;g<_;g++){const m=d[g],p=o[m.materialIndex],x=Math.max(m.start,f.start),M=Math.min(l.count,Math.min(m.start+m.count,f.start+f.count));for(let v=x,A=M;v<A;v+=3){const E=v,R=v+1,P=v+2;s=Tr(this,p,t,n,c,h,u,E,R,P),s&&(s.faceIndex=Math.floor(v/3),s.face.materialIndex=m.materialIndex,e.push(s))}}else{const g=Math.max(0,f.start),_=Math.min(l.count,f.start+f.count);for(let m=g,p=_;m<p;m+=3){const x=m,M=m+1,v=m+2;s=Tr(this,o,t,n,c,h,u,x,M,v),s&&(s.faceIndex=Math.floor(m/3),e.push(s))}}}}function Df(i,t,e,n,s,r,o,a){let l;if(t.side===Ye?l=n.intersectTriangle(o,r,s,!0,a):l=n.intersectTriangle(s,r,o,t.side===bn,a),l===null)return null;Er.copy(a),Er.applyMatrix4(i.matrixWorld);const c=e.ray.origin.distanceTo(Er);return c<e.near||c>e.far?null:{distance:c,point:Er.clone(),object:i}}function Tr(i,t,e,n,s,r,o,a,l,c){i.getVertexPosition(a,yr),i.getVertexPosition(l,br),i.getVertexPosition(c,Sr);const h=Df(i,t,e,n,yr,br,Sr,Sc);if(h){const u=new T;pn.getBarycoord(Sc,yr,br,Sr,u),s&&(h.uv=pn.getInterpolatedAttribute(s,a,l,c,u,new H)),r&&(h.uv1=pn.getInterpolatedAttribute(r,a,l,c,u,new H)),o&&(h.normal=pn.getInterpolatedAttribute(o,a,l,c,u,new T),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));const d={a,b:l,c,normal:new T,materialIndex:0};pn.getNormal(yr,br,Sr,d.normal),h.face=d,h.barycoord=u}return h}class qe extends pe{constructor(t=1,e=1,n=1,s=1,r=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:n,widthSegments:s,heightSegments:r,depthSegments:o};const a=this;s=Math.floor(s),r=Math.floor(r),o=Math.floor(o);const l=[],c=[],h=[],u=[];let d=0,f=0;g("z","y","x",-1,-1,n,e,t,o,r,0),g("z","y","x",1,-1,n,e,-t,o,r,1),g("x","z","y",1,1,t,n,e,s,o,2),g("x","z","y",1,-1,t,n,-e,s,o,3),g("x","y","z",1,-1,t,e,n,s,r,4),g("x","y","z",-1,-1,t,e,-n,s,r,5),this.setIndex(l),this.setAttribute("position",new jt(c,3)),this.setAttribute("normal",new jt(h,3)),this.setAttribute("uv",new jt(u,2));function g(_,m,p,x,M,v,A,E,R,P,b){const y=v/R,I=A/P,F=v/2,U=A/2,O=E/2,V=R+1,G=P+1;let D=0,N=0;const j=new T;for(let it=0;it<G;it++){const ut=it*I-U;for(let Dt=0;Dt<V;Dt++){const $t=Dt*y-F;j[_]=$t*x,j[m]=ut*M,j[p]=O,c.push(j.x,j.y,j.z),j[_]=0,j[m]=0,j[p]=E>0?1:-1,h.push(j.x,j.y,j.z),u.push(Dt/R),u.push(1-it/P),D+=1}}for(let it=0;it<P;it++)for(let ut=0;ut<R;ut++){const Dt=d+ut+V*it,$t=d+ut+V*(it+1),Q=d+(ut+1)+V*(it+1),st=d+(ut+1)+V*it;l.push(Dt,$t,st),l.push($t,Q,st),N+=6}a.addGroup(f,N,b),f+=N,d+=D}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new qe(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}}function as(i){const t={};for(const e in i){t[e]={};for(const n in i[e]){const s=i[e][n];s&&(s.isColor||s.isMatrix3||s.isMatrix4||s.isVector2||s.isVector3||s.isVector4||s.isTexture||s.isQuaternion)?s.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][n]=null):t[e][n]=s.clone():Array.isArray(s)?t[e][n]=s.slice():t[e][n]=s}}return t}function We(i){const t={};for(let e=0;e<i.length;e++){const n=as(i[e]);for(const s in n)t[s]=n[s]}return t}function Uf(i){const t=[];for(let e=0;e<i.length;e++)t.push(i[e].clone());return t}function yu(i){const t=i.getRenderTarget();return t===null?i.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:Qt.workingColorSpace}const Nf={clone:as,merge:We};var Of=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Ff=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class nn extends cs{static get type(){return"ShaderMaterial"}constructor(t){super(),this.isShaderMaterial=!0,this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Of,this.fragmentShader=Ff,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=as(t.uniforms),this.uniformsGroups=Uf(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this}toJSON(t){const e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(const s in this.uniforms){const o=this.uniforms[s].value;o&&o.isTexture?e.uniforms[s]={type:"t",value:o.toJSON(t).uuid}:o&&o.isColor?e.uniforms[s]={type:"c",value:o.getHex()}:o&&o.isVector2?e.uniforms[s]={type:"v2",value:o.toArray()}:o&&o.isVector3?e.uniforms[s]={type:"v3",value:o.toArray()}:o&&o.isVector4?e.uniforms[s]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?e.uniforms[s]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?e.uniforms[s]={type:"m4",value:o.toArray()}:e.uniforms[s]={value:o}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;const n={};for(const s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(e.extensions=n),e}}class bu extends Pe{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Jt,this.projectionMatrix=new Jt,this.projectionMatrixInverse=new Jt,this.coordinateSystem=Un}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(t,e){super.updateWorldMatrix(t,e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}const qn=new T,wc=new H,Ec=new H;class tn extends bu{constructor(t=50,e=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){const e=.5*this.getFilmHeight()/t;this.fov=Xs*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){const t=Math.tan(Ds*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return Xs*2*Math.atan(Math.tan(Ds*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,e,n){qn.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),e.set(qn.x,qn.y).multiplyScalar(-t/qn.z),qn.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(qn.x,qn.y).multiplyScalar(-t/qn.z)}getViewSize(t,e){return this.getViewBounds(t,wc,Ec),e.subVectors(Ec,wc)}setViewOffset(t,e,n,s,r,o){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=this.near;let e=t*Math.tan(Ds*.5*this.fov)/this.zoom,n=2*e,s=this.aspect*n,r=-.5*s;const o=this.view;if(this.view!==null&&this.view.enabled){const l=o.fullWidth,c=o.fullHeight;r+=o.offsetX*s/l,e-=o.offsetY*n/c,s*=o.width/l,n*=o.height/c}const a=this.filmOffset;a!==0&&(r+=t*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,e,e-n,t,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}}const Hi=-90,Vi=1;class Bf extends Pe{constructor(t,e,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const s=new tn(Hi,Vi,t,e);s.layers=this.layers,this.add(s);const r=new tn(Hi,Vi,t,e);r.layers=this.layers,this.add(r);const o=new tn(Hi,Vi,t,e);o.layers=this.layers,this.add(o);const a=new tn(Hi,Vi,t,e);a.layers=this.layers,this.add(a);const l=new tn(Hi,Vi,t,e);l.layers=this.layers,this.add(l);const c=new tn(Hi,Vi,t,e);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const t=this.coordinateSystem,e=this.children.concat(),[n,s,r,o,a,l]=e;for(const c of e)this.remove(c);if(t===Un)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(t===io)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(const c of e)this.add(c),c.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());const[r,o,a,l,c,h]=this.children,u=t.getRenderTarget(),d=t.getActiveCubeFace(),f=t.getActiveMipmapLevel(),g=t.xr.enabled;t.xr.enabled=!1;const _=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,t.setRenderTarget(n,0,s),t.render(e,r),t.setRenderTarget(n,1,s),t.render(e,o),t.setRenderTarget(n,2,s),t.render(e,a),t.setRenderTarget(n,3,s),t.render(e,l),t.setRenderTarget(n,4,s),t.render(e,c),n.texture.generateMipmaps=_,t.setRenderTarget(n,5,s),t.render(e,h),t.setRenderTarget(u,d,f),t.xr.enabled=g,n.texture.needsPMREMUpdate=!0}}class Su extends Ve{constructor(t,e,n,s,r,o,a,l,c,h){t=t!==void 0?t:[],e=e!==void 0?e:ns,super(t,e,n,s,r,o,a,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}}class kf extends Si{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;const n={width:t,height:t,depth:1},s=[n,n,n,n,n,n];this.texture=new Su(s,e.mapping,e.wrapS,e.wrapT,e.magFilter,e.minFilter,e.format,e.type,e.anisotropy,e.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=e.generateMipmaps!==void 0?e.generateMipmaps:!1,this.texture.minFilter=e.minFilter!==void 0?e.minFilter:Mn}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

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
			`},s=new qe(5,5,5),r=new nn({name:"CubemapFromEquirect",uniforms:as(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Ye,blending:ti});r.uniforms.tEquirect.value=e;const o=new J(s,r),a=e.minFilter;return e.minFilter===_i&&(e.minFilter=Mn),new Bf(1,10,this).update(t,o),e.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(t,e,n,s){const r=t.getRenderTarget();for(let o=0;o<6;o++)t.setRenderTarget(this,o),t.clear(e,n,s);t.setRenderTarget(r)}}const $o=new T,zf=new T,Hf=new qt;class Kn{constructor(t=new T(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,n,s){return this.normal.set(t,e,n),this.constant=s,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,n){const s=$o.subVectors(n,e).cross(zf.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(s,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){const t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e){const n=t.delta($o),s=this.normal.dot(n);if(s===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;const r=-(t.start.dot(this.normal)+this.constant)/s;return r<0||r>1?null:e.copy(t.start).addScaledVector(n,r)}intersectsLine(t){const e=this.distanceToPoint(t.start),n=this.distanceToPoint(t.end);return e<0&&n>0||n<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){const n=e||Hf.getNormalMatrix(t),s=this.coplanarPoint($o).applyMatrix4(t),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}}const hi=new si,Ar=new T;class Ul{constructor(t=new Kn,e=new Kn,n=new Kn,s=new Kn,r=new Kn,o=new Kn){this.planes=[t,e,n,s,r,o]}set(t,e,n,s,r,o){const a=this.planes;return a[0].copy(t),a[1].copy(e),a[2].copy(n),a[3].copy(s),a[4].copy(r),a[5].copy(o),this}copy(t){const e=this.planes;for(let n=0;n<6;n++)e[n].copy(t.planes[n]);return this}setFromProjectionMatrix(t,e=Un){const n=this.planes,s=t.elements,r=s[0],o=s[1],a=s[2],l=s[3],c=s[4],h=s[5],u=s[6],d=s[7],f=s[8],g=s[9],_=s[10],m=s[11],p=s[12],x=s[13],M=s[14],v=s[15];if(n[0].setComponents(l-r,d-c,m-f,v-p).normalize(),n[1].setComponents(l+r,d+c,m+f,v+p).normalize(),n[2].setComponents(l+o,d+h,m+g,v+x).normalize(),n[3].setComponents(l-o,d-h,m-g,v-x).normalize(),n[4].setComponents(l-a,d-u,m-_,v-M).normalize(),e===Un)n[5].setComponents(l+a,d+u,m+_,v+M).normalize();else if(e===io)n[5].setComponents(a,u,_,M).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),hi.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{const e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),hi.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(hi)}intersectsSprite(t){return hi.center.set(0,0,0),hi.radius=.7071067811865476,hi.applyMatrix4(t.matrixWorld),this.intersectsSphere(hi)}intersectsSphere(t){const e=this.planes,n=t.center,s=-t.radius;for(let r=0;r<6;r++)if(e[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(t){const e=this.planes;for(let n=0;n<6;n++){const s=e[n];if(Ar.x=s.normal.x>0?t.max.x:t.min.x,Ar.y=s.normal.y>0?t.max.y:t.min.y,Ar.z=s.normal.z>0?t.max.z:t.min.z,s.distanceToPoint(Ar)<0)return!1}return!0}containsPoint(t){const e=this.planes;for(let n=0;n<6;n++)if(e[n].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}function wu(){let i=null,t=!1,e=null,n=null;function s(r,o){e(r,o),n=i.requestAnimationFrame(s)}return{start:function(){t!==!0&&e!==null&&(n=i.requestAnimationFrame(s),t=!0)},stop:function(){i.cancelAnimationFrame(n),t=!1},setAnimationLoop:function(r){e=r},setContext:function(r){i=r}}}function Vf(i){const t=new WeakMap;function e(a,l){const c=a.array,h=a.usage,u=c.byteLength,d=i.createBuffer();i.bindBuffer(l,d),i.bufferData(l,c,h),a.onUploadCallback();let f;if(c instanceof Float32Array)f=i.FLOAT;else if(c instanceof Uint16Array)a.isFloat16BufferAttribute?f=i.HALF_FLOAT:f=i.UNSIGNED_SHORT;else if(c instanceof Int16Array)f=i.SHORT;else if(c instanceof Uint32Array)f=i.UNSIGNED_INT;else if(c instanceof Int32Array)f=i.INT;else if(c instanceof Int8Array)f=i.BYTE;else if(c instanceof Uint8Array)f=i.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)f=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:d,type:f,bytesPerElement:c.BYTES_PER_ELEMENT,version:a.version,size:u}}function n(a,l,c){const h=l.array,u=l.updateRanges;if(i.bindBuffer(c,a),u.length===0)i.bufferSubData(c,0,h);else{u.sort((f,g)=>f.start-g.start);let d=0;for(let f=1;f<u.length;f++){const g=u[d],_=u[f];_.start<=g.start+g.count+1?g.count=Math.max(g.count,_.start+_.count-g.start):(++d,u[d]=_)}u.length=d+1;for(let f=0,g=u.length;f<g;f++){const _=u[f];i.bufferSubData(c,_.start*h.BYTES_PER_ELEMENT,h,_.start,_.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(a){return a.isInterleavedBufferAttribute&&(a=a.data),t.get(a)}function r(a){a.isInterleavedBufferAttribute&&(a=a.data);const l=t.get(a);l&&(i.deleteBuffer(l.buffer),t.delete(a))}function o(a,l){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){const h=t.get(a);(!h||h.version<a.version)&&t.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}const c=t.get(a);if(c===void 0)t.set(a,e(a,l));else if(c.version<a.version){if(c.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,a,l),c.version=a.version}}return{get:s,remove:r,update:o}}class ze extends pe{constructor(t=1,e=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:n,heightSegments:s};const r=t/2,o=e/2,a=Math.floor(n),l=Math.floor(s),c=a+1,h=l+1,u=t/a,d=e/l,f=[],g=[],_=[],m=[];for(let p=0;p<h;p++){const x=p*d-o;for(let M=0;M<c;M++){const v=M*u-r;g.push(v,-x,0),_.push(0,0,1),m.push(M/a),m.push(1-p/l)}}for(let p=0;p<l;p++)for(let x=0;x<a;x++){const M=x+c*p,v=x+c*(p+1),A=x+1+c*(p+1),E=x+1+c*p;f.push(M,v,E),f.push(v,A,E)}this.setIndex(f),this.setAttribute("position",new jt(g,3)),this.setAttribute("normal",new jt(_,3)),this.setAttribute("uv",new jt(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new ze(t.width,t.height,t.widthSegments,t.heightSegments)}}var Gf=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Wf=`#ifdef USE_ALPHAHASH
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
#endif`,qf=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Yf=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Xf=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,$f=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,jf=`#ifdef USE_AOMAP
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
#endif`,Kf=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Zf=`#ifdef USE_BATCHING
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
#endif`,Jf=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Qf=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,tp=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,ep=`float G_BlinnPhong_Implicit( ) {
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
} // validated`,np=`#ifdef USE_IRIDESCENCE
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
#endif`,ip=`#ifdef USE_BUMPMAP
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
#endif`,sp=`#if NUM_CLIPPING_PLANES > 0
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
#endif`,rp=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,op=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,ap=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,lp=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,cp=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,hp=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,up=`#if defined( USE_COLOR_ALPHA )
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
#endif`,dp=`#define PI 3.141592653589793
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
} // validated`,fp=`#ifdef ENVMAP_TYPE_CUBE_UV
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
#endif`,pp=`vec3 transformedNormal = objectNormal;
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
#endif`,mp=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,gp=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,vp=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,_p=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Mp="gl_FragColor = linearToOutputTexel( gl_FragColor );",xp=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,yp=`#ifdef USE_ENVMAP
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
#endif`,bp=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,Sp=`#ifdef USE_ENVMAP
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
#endif`,wp=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Ep=`#ifdef USE_ENVMAP
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
#endif`,Tp=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Ap=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Cp=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Rp=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Pp=`#ifdef USE_GRADIENTMAP
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
}`,Lp=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Ip=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Dp=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Up=`uniform bool receiveShadow;
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
#endif`,Np=`#ifdef USE_ENVMAP
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
#endif`,Op=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Fp=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Bp=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,kp=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,zp=`PhysicalMaterial material;
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
#endif`,Hp=`struct PhysicalMaterial {
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
}`,Vp=`
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
#endif`,Gp=`#if defined( RE_IndirectDiffuse )
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
#endif`,Wp=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,qp=`#if defined( USE_LOGDEPTHBUF )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Yp=`#if defined( USE_LOGDEPTHBUF )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Xp=`#ifdef USE_LOGDEPTHBUF
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,$p=`#ifdef USE_LOGDEPTHBUF
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,jp=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Kp=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Zp=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
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
#endif`,Jp=`#if defined( USE_POINTS_UV )
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
#endif`,Qp=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,tm=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,em=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,nm=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,im=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,sm=`#ifdef USE_MORPHTARGETS
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
#endif`,rm=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,om=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
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
vec3 nonPerturbedNormal = normal;`,am=`#ifdef USE_NORMALMAP_OBJECTSPACE
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
#endif`,lm=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,cm=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,hm=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,um=`#ifdef USE_NORMALMAP
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
#endif`,dm=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,fm=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,pm=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,mm=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,gm=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,vm=`vec3 packNormalToRGB( const in vec3 normal ) {
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
}`,_m=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Mm=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,xm=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,ym=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,bm=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Sm=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,wm=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,Em=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,Tm=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
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
#endif`,Am=`float getShadowMask() {
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
}`,Cm=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Rm=`#ifdef USE_SKINNING
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
#endif`,Pm=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Lm=`#ifdef USE_SKINNING
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
#endif`,Im=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Dm=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Um=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Nm=`#ifndef saturate
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
vec3 CustomToneMapping( vec3 color ) { return color; }`,Om=`#ifdef USE_TRANSMISSION
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
#endif`,Fm=`#ifdef USE_TRANSMISSION
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
#endif`,Bm=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,km=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,zm=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,Hm=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const Vm=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Gm=`uniform sampler2D t2D;
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
}`,Wm=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,qm=`#ifdef ENVMAP_TYPE_CUBE
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
}`,Ym=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Xm=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,$m=`#include <common>
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
}`,jm=`#if DEPTH_PACKING == 3200
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
}`,Km=`#define DISTANCE
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
}`,Zm=`#define DISTANCE
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
}`,Jm=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Qm=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,t0=`uniform float scale;
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
}`,e0=`uniform vec3 diffuse;
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
}`,n0=`#include <common>
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
}`,i0=`uniform vec3 diffuse;
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
}`,s0=`#define LAMBERT
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
}`,r0=`#define LAMBERT
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
}`,o0=`#define MATCAP
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
}`,a0=`#define MATCAP
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
}`,l0=`#define NORMAL
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
}`,c0=`#define NORMAL
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
}`,h0=`#define PHONG
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
}`,u0=`#define PHONG
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
}`,d0=`#define STANDARD
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
}`,f0=`#define STANDARD
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
}`,p0=`#define TOON
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
}`,m0=`#define TOON
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
}`,g0=`uniform float size;
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
}`,v0=`uniform vec3 diffuse;
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
}`,_0=`#include <common>
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
}`,M0=`uniform vec3 color;
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
}`,x0=`uniform float rotation;
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
}`,y0=`uniform vec3 diffuse;
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
}`,Xt={alphahash_fragment:Gf,alphahash_pars_fragment:Wf,alphamap_fragment:qf,alphamap_pars_fragment:Yf,alphatest_fragment:Xf,alphatest_pars_fragment:$f,aomap_fragment:jf,aomap_pars_fragment:Kf,batching_pars_vertex:Zf,batching_vertex:Jf,begin_vertex:Qf,beginnormal_vertex:tp,bsdfs:ep,iridescence_fragment:np,bumpmap_pars_fragment:ip,clipping_planes_fragment:sp,clipping_planes_pars_fragment:rp,clipping_planes_pars_vertex:op,clipping_planes_vertex:ap,color_fragment:lp,color_pars_fragment:cp,color_pars_vertex:hp,color_vertex:up,common:dp,cube_uv_reflection_fragment:fp,defaultnormal_vertex:pp,displacementmap_pars_vertex:mp,displacementmap_vertex:gp,emissivemap_fragment:vp,emissivemap_pars_fragment:_p,colorspace_fragment:Mp,colorspace_pars_fragment:xp,envmap_fragment:yp,envmap_common_pars_fragment:bp,envmap_pars_fragment:Sp,envmap_pars_vertex:wp,envmap_physical_pars_fragment:Np,envmap_vertex:Ep,fog_vertex:Tp,fog_pars_vertex:Ap,fog_fragment:Cp,fog_pars_fragment:Rp,gradientmap_pars_fragment:Pp,lightmap_pars_fragment:Lp,lights_lambert_fragment:Ip,lights_lambert_pars_fragment:Dp,lights_pars_begin:Up,lights_toon_fragment:Op,lights_toon_pars_fragment:Fp,lights_phong_fragment:Bp,lights_phong_pars_fragment:kp,lights_physical_fragment:zp,lights_physical_pars_fragment:Hp,lights_fragment_begin:Vp,lights_fragment_maps:Gp,lights_fragment_end:Wp,logdepthbuf_fragment:qp,logdepthbuf_pars_fragment:Yp,logdepthbuf_pars_vertex:Xp,logdepthbuf_vertex:$p,map_fragment:jp,map_pars_fragment:Kp,map_particle_fragment:Zp,map_particle_pars_fragment:Jp,metalnessmap_fragment:Qp,metalnessmap_pars_fragment:tm,morphinstance_vertex:em,morphcolor_vertex:nm,morphnormal_vertex:im,morphtarget_pars_vertex:sm,morphtarget_vertex:rm,normal_fragment_begin:om,normal_fragment_maps:am,normal_pars_fragment:lm,normal_pars_vertex:cm,normal_vertex:hm,normalmap_pars_fragment:um,clearcoat_normal_fragment_begin:dm,clearcoat_normal_fragment_maps:fm,clearcoat_pars_fragment:pm,iridescence_pars_fragment:mm,opaque_fragment:gm,packing:vm,premultiplied_alpha_fragment:_m,project_vertex:Mm,dithering_fragment:xm,dithering_pars_fragment:ym,roughnessmap_fragment:bm,roughnessmap_pars_fragment:Sm,shadowmap_pars_fragment:wm,shadowmap_pars_vertex:Em,shadowmap_vertex:Tm,shadowmask_pars_fragment:Am,skinbase_vertex:Cm,skinning_pars_vertex:Rm,skinning_vertex:Pm,skinnormal_vertex:Lm,specularmap_fragment:Im,specularmap_pars_fragment:Dm,tonemapping_fragment:Um,tonemapping_pars_fragment:Nm,transmission_fragment:Om,transmission_pars_fragment:Fm,uv_pars_fragment:Bm,uv_pars_vertex:km,uv_vertex:zm,worldpos_vertex:Hm,background_vert:Vm,background_frag:Gm,backgroundCube_vert:Wm,backgroundCube_frag:qm,cube_vert:Ym,cube_frag:Xm,depth_vert:$m,depth_frag:jm,distanceRGBA_vert:Km,distanceRGBA_frag:Zm,equirect_vert:Jm,equirect_frag:Qm,linedashed_vert:t0,linedashed_frag:e0,meshbasic_vert:n0,meshbasic_frag:i0,meshlambert_vert:s0,meshlambert_frag:r0,meshmatcap_vert:o0,meshmatcap_frag:a0,meshnormal_vert:l0,meshnormal_frag:c0,meshphong_vert:h0,meshphong_frag:u0,meshphysical_vert:d0,meshphysical_frag:f0,meshtoon_vert:p0,meshtoon_frag:m0,points_vert:g0,points_frag:v0,shadow_vert:_0,shadow_frag:M0,sprite_vert:x0,sprite_frag:y0},pt={common:{diffuse:{value:new St(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new qt},alphaMap:{value:null},alphaMapTransform:{value:new qt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new qt}},envmap:{envMap:{value:null},envMapRotation:{value:new qt},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new qt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new qt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new qt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new qt},normalScale:{value:new H(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new qt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new qt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new qt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new qt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new St(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new St(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new qt},alphaTest:{value:0},uvTransform:{value:new qt}},sprite:{diffuse:{value:new St(16777215)},opacity:{value:1},center:{value:new H(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new qt},alphaMap:{value:null},alphaMapTransform:{value:new qt},alphaTest:{value:0}}},vn={basic:{uniforms:We([pt.common,pt.specularmap,pt.envmap,pt.aomap,pt.lightmap,pt.fog]),vertexShader:Xt.meshbasic_vert,fragmentShader:Xt.meshbasic_frag},lambert:{uniforms:We([pt.common,pt.specularmap,pt.envmap,pt.aomap,pt.lightmap,pt.emissivemap,pt.bumpmap,pt.normalmap,pt.displacementmap,pt.fog,pt.lights,{emissive:{value:new St(0)}}]),vertexShader:Xt.meshlambert_vert,fragmentShader:Xt.meshlambert_frag},phong:{uniforms:We([pt.common,pt.specularmap,pt.envmap,pt.aomap,pt.lightmap,pt.emissivemap,pt.bumpmap,pt.normalmap,pt.displacementmap,pt.fog,pt.lights,{emissive:{value:new St(0)},specular:{value:new St(1118481)},shininess:{value:30}}]),vertexShader:Xt.meshphong_vert,fragmentShader:Xt.meshphong_frag},standard:{uniforms:We([pt.common,pt.envmap,pt.aomap,pt.lightmap,pt.emissivemap,pt.bumpmap,pt.normalmap,pt.displacementmap,pt.roughnessmap,pt.metalnessmap,pt.fog,pt.lights,{emissive:{value:new St(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Xt.meshphysical_vert,fragmentShader:Xt.meshphysical_frag},toon:{uniforms:We([pt.common,pt.aomap,pt.lightmap,pt.emissivemap,pt.bumpmap,pt.normalmap,pt.displacementmap,pt.gradientmap,pt.fog,pt.lights,{emissive:{value:new St(0)}}]),vertexShader:Xt.meshtoon_vert,fragmentShader:Xt.meshtoon_frag},matcap:{uniforms:We([pt.common,pt.bumpmap,pt.normalmap,pt.displacementmap,pt.fog,{matcap:{value:null}}]),vertexShader:Xt.meshmatcap_vert,fragmentShader:Xt.meshmatcap_frag},points:{uniforms:We([pt.points,pt.fog]),vertexShader:Xt.points_vert,fragmentShader:Xt.points_frag},dashed:{uniforms:We([pt.common,pt.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Xt.linedashed_vert,fragmentShader:Xt.linedashed_frag},depth:{uniforms:We([pt.common,pt.displacementmap]),vertexShader:Xt.depth_vert,fragmentShader:Xt.depth_frag},normal:{uniforms:We([pt.common,pt.bumpmap,pt.normalmap,pt.displacementmap,{opacity:{value:1}}]),vertexShader:Xt.meshnormal_vert,fragmentShader:Xt.meshnormal_frag},sprite:{uniforms:We([pt.sprite,pt.fog]),vertexShader:Xt.sprite_vert,fragmentShader:Xt.sprite_frag},background:{uniforms:{uvTransform:{value:new qt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Xt.background_vert,fragmentShader:Xt.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new qt}},vertexShader:Xt.backgroundCube_vert,fragmentShader:Xt.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Xt.cube_vert,fragmentShader:Xt.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Xt.equirect_vert,fragmentShader:Xt.equirect_frag},distanceRGBA:{uniforms:We([pt.common,pt.displacementmap,{referencePosition:{value:new T},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Xt.distanceRGBA_vert,fragmentShader:Xt.distanceRGBA_frag},shadow:{uniforms:We([pt.lights,pt.fog,{color:{value:new St(0)},opacity:{value:1}}]),vertexShader:Xt.shadow_vert,fragmentShader:Xt.shadow_frag}};vn.physical={uniforms:We([vn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new qt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new qt},clearcoatNormalScale:{value:new H(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new qt},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new qt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new qt},sheen:{value:0},sheenColor:{value:new St(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new qt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new qt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new qt},transmissionSamplerSize:{value:new H},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new qt},attenuationDistance:{value:0},attenuationColor:{value:new St(0)},specularColor:{value:new St(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new qt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new qt},anisotropyVector:{value:new H},anisotropyMap:{value:null},anisotropyMapTransform:{value:new qt}}]),vertexShader:Xt.meshphysical_vert,fragmentShader:Xt.meshphysical_frag};const Cr={r:0,b:0,g:0},ui=new ln,b0=new Jt;function S0(i,t,e,n,s,r,o){const a=new St(0);let l=r===!0?0:1,c,h,u=null,d=0,f=null;function g(x){let M=x.isScene===!0?x.background:null;return M&&M.isTexture&&(M=(x.backgroundBlurriness>0?e:t).get(M)),M}function _(x){let M=!1;const v=g(x);v===null?p(a,l):v&&v.isColor&&(p(v,1),M=!0);const A=i.xr.getEnvironmentBlendMode();A==="additive"?n.buffers.color.setClear(0,0,0,1,o):A==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,o),(i.autoClear||M)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function m(x,M){const v=g(M);v&&(v.isCubeTexture||v.mapping===fo)?(h===void 0&&(h=new J(new qe(1,1,1),new nn({name:"BackgroundCubeMaterial",uniforms:as(vn.backgroundCube.uniforms),vertexShader:vn.backgroundCube.vertexShader,fragmentShader:vn.backgroundCube.fragmentShader,side:Ye,depthTest:!1,depthWrite:!1,fog:!1})),h.geometry.deleteAttribute("normal"),h.geometry.deleteAttribute("uv"),h.onBeforeRender=function(A,E,R){this.matrixWorld.copyPosition(R.matrixWorld)},Object.defineProperty(h.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),s.update(h)),ui.copy(M.backgroundRotation),ui.x*=-1,ui.y*=-1,ui.z*=-1,v.isCubeTexture&&v.isRenderTargetTexture===!1&&(ui.y*=-1,ui.z*=-1),h.material.uniforms.envMap.value=v,h.material.uniforms.flipEnvMap.value=v.isCubeTexture&&v.isRenderTargetTexture===!1?-1:1,h.material.uniforms.backgroundBlurriness.value=M.backgroundBlurriness,h.material.uniforms.backgroundIntensity.value=M.backgroundIntensity,h.material.uniforms.backgroundRotation.value.setFromMatrix4(b0.makeRotationFromEuler(ui)),h.material.toneMapped=Qt.getTransfer(v.colorSpace)!==ae,(u!==v||d!==v.version||f!==i.toneMapping)&&(h.material.needsUpdate=!0,u=v,d=v.version,f=i.toneMapping),h.layers.enableAll(),x.unshift(h,h.geometry,h.material,0,0,null)):v&&v.isTexture&&(c===void 0&&(c=new J(new ze(2,2),new nn({name:"BackgroundMaterial",uniforms:as(vn.background.uniforms),vertexShader:vn.background.vertexShader,fragmentShader:vn.background.fragmentShader,side:bn,depthTest:!1,depthWrite:!1,fog:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),s.update(c)),c.material.uniforms.t2D.value=v,c.material.uniforms.backgroundIntensity.value=M.backgroundIntensity,c.material.toneMapped=Qt.getTransfer(v.colorSpace)!==ae,v.matrixAutoUpdate===!0&&v.updateMatrix(),c.material.uniforms.uvTransform.value.copy(v.matrix),(u!==v||d!==v.version||f!==i.toneMapping)&&(c.material.needsUpdate=!0,u=v,d=v.version,f=i.toneMapping),c.layers.enableAll(),x.unshift(c,c.geometry,c.material,0,0,null))}function p(x,M){x.getRGB(Cr,yu(i)),n.buffers.color.setClear(Cr.r,Cr.g,Cr.b,M,o)}return{getClearColor:function(){return a},setClearColor:function(x,M=1){a.set(x),l=M,p(a,l)},getClearAlpha:function(){return l},setClearAlpha:function(x){l=x,p(a,l)},render:_,addToRenderList:m}}function w0(i,t){const e=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=d(null);let r=s,o=!1;function a(y,I,F,U,O){let V=!1;const G=u(U,F,I);r!==G&&(r=G,c(r.object)),V=f(y,U,F,O),V&&g(y,U,F,O),O!==null&&t.update(O,i.ELEMENT_ARRAY_BUFFER),(V||o)&&(o=!1,v(y,I,F,U),O!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,t.get(O).buffer))}function l(){return i.createVertexArray()}function c(y){return i.bindVertexArray(y)}function h(y){return i.deleteVertexArray(y)}function u(y,I,F){const U=F.wireframe===!0;let O=n[y.id];O===void 0&&(O={},n[y.id]=O);let V=O[I.id];V===void 0&&(V={},O[I.id]=V);let G=V[U];return G===void 0&&(G=d(l()),V[U]=G),G}function d(y){const I=[],F=[],U=[];for(let O=0;O<e;O++)I[O]=0,F[O]=0,U[O]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:I,enabledAttributes:F,attributeDivisors:U,object:y,attributes:{},index:null}}function f(y,I,F,U){const O=r.attributes,V=I.attributes;let G=0;const D=F.getAttributes();for(const N in D)if(D[N].location>=0){const it=O[N];let ut=V[N];if(ut===void 0&&(N==="instanceMatrix"&&y.instanceMatrix&&(ut=y.instanceMatrix),N==="instanceColor"&&y.instanceColor&&(ut=y.instanceColor)),it===void 0||it.attribute!==ut||ut&&it.data!==ut.data)return!0;G++}return r.attributesNum!==G||r.index!==U}function g(y,I,F,U){const O={},V=I.attributes;let G=0;const D=F.getAttributes();for(const N in D)if(D[N].location>=0){let it=V[N];it===void 0&&(N==="instanceMatrix"&&y.instanceMatrix&&(it=y.instanceMatrix),N==="instanceColor"&&y.instanceColor&&(it=y.instanceColor));const ut={};ut.attribute=it,it&&it.data&&(ut.data=it.data),O[N]=ut,G++}r.attributes=O,r.attributesNum=G,r.index=U}function _(){const y=r.newAttributes;for(let I=0,F=y.length;I<F;I++)y[I]=0}function m(y){p(y,0)}function p(y,I){const F=r.newAttributes,U=r.enabledAttributes,O=r.attributeDivisors;F[y]=1,U[y]===0&&(i.enableVertexAttribArray(y),U[y]=1),O[y]!==I&&(i.vertexAttribDivisor(y,I),O[y]=I)}function x(){const y=r.newAttributes,I=r.enabledAttributes;for(let F=0,U=I.length;F<U;F++)I[F]!==y[F]&&(i.disableVertexAttribArray(F),I[F]=0)}function M(y,I,F,U,O,V,G){G===!0?i.vertexAttribIPointer(y,I,F,O,V):i.vertexAttribPointer(y,I,F,U,O,V)}function v(y,I,F,U){_();const O=U.attributes,V=F.getAttributes(),G=I.defaultAttributeValues;for(const D in V){const N=V[D];if(N.location>=0){let j=O[D];if(j===void 0&&(D==="instanceMatrix"&&y.instanceMatrix&&(j=y.instanceMatrix),D==="instanceColor"&&y.instanceColor&&(j=y.instanceColor)),j!==void 0){const it=j.normalized,ut=j.itemSize,Dt=t.get(j);if(Dt===void 0)continue;const $t=Dt.buffer,Q=Dt.type,st=Dt.bytesPerElement,ft=Q===i.INT||Q===i.UNSIGNED_INT||j.gpuType===wl;if(j.isInterleavedBufferAttribute){const rt=j.data,Pt=rt.stride,Lt=j.offset;if(rt.isInstancedInterleavedBuffer){for(let _t=0;_t<N.locationSize;_t++)p(N.location+_t,rt.meshPerAttribute);y.isInstancedMesh!==!0&&U._maxInstanceCount===void 0&&(U._maxInstanceCount=rt.meshPerAttribute*rt.count)}else for(let _t=0;_t<N.locationSize;_t++)m(N.location+_t);i.bindBuffer(i.ARRAY_BUFFER,$t);for(let _t=0;_t<N.locationSize;_t++)M(N.location+_t,ut/N.locationSize,Q,it,Pt*st,(Lt+ut/N.locationSize*_t)*st,ft)}else{if(j.isInstancedBufferAttribute){for(let rt=0;rt<N.locationSize;rt++)p(N.location+rt,j.meshPerAttribute);y.isInstancedMesh!==!0&&U._maxInstanceCount===void 0&&(U._maxInstanceCount=j.meshPerAttribute*j.count)}else for(let rt=0;rt<N.locationSize;rt++)m(N.location+rt);i.bindBuffer(i.ARRAY_BUFFER,$t);for(let rt=0;rt<N.locationSize;rt++)M(N.location+rt,ut/N.locationSize,Q,it,ut*st,ut/N.locationSize*rt*st,ft)}}else if(G!==void 0){const it=G[D];if(it!==void 0)switch(it.length){case 2:i.vertexAttrib2fv(N.location,it);break;case 3:i.vertexAttrib3fv(N.location,it);break;case 4:i.vertexAttrib4fv(N.location,it);break;default:i.vertexAttrib1fv(N.location,it)}}}}x()}function A(){P();for(const y in n){const I=n[y];for(const F in I){const U=I[F];for(const O in U)h(U[O].object),delete U[O];delete I[F]}delete n[y]}}function E(y){if(n[y.id]===void 0)return;const I=n[y.id];for(const F in I){const U=I[F];for(const O in U)h(U[O].object),delete U[O];delete I[F]}delete n[y.id]}function R(y){for(const I in n){const F=n[I];if(F[y.id]===void 0)continue;const U=F[y.id];for(const O in U)h(U[O].object),delete U[O];delete F[y.id]}}function P(){b(),o=!0,r!==s&&(r=s,c(r.object))}function b(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:a,reset:P,resetDefaultState:b,dispose:A,releaseStatesOfGeometry:E,releaseStatesOfProgram:R,initAttributes:_,enableAttribute:m,disableUnusedAttributes:x}}function E0(i,t,e){let n;function s(c){n=c}function r(c,h){i.drawArrays(n,c,h),e.update(h,n,1)}function o(c,h,u){u!==0&&(i.drawArraysInstanced(n,c,h,u),e.update(h,n,u))}function a(c,h,u){if(u===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,c,0,h,0,u);let f=0;for(let g=0;g<u;g++)f+=h[g];e.update(f,n,1)}function l(c,h,u,d){if(u===0)return;const f=t.get("WEBGL_multi_draw");if(f===null)for(let g=0;g<c.length;g++)o(c[g],h[g],d[g]);else{f.multiDrawArraysInstancedWEBGL(n,c,0,h,0,d,0,u);let g=0;for(let _=0;_<u;_++)g+=h[_]*d[_];e.update(g,n,1)}}this.setMode=s,this.render=r,this.renderInstances=o,this.renderMultiDraw=a,this.renderMultiDrawInstances=l}function T0(i,t,e,n){let s;function r(){if(s!==void 0)return s;if(t.has("EXT_texture_filter_anisotropic")===!0){const R=t.get("EXT_texture_filter_anisotropic");s=i.getParameter(R.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function o(R){return!(R!==mn&&n.convert(R)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(R){const P=R===er&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(R!==On&&n.convert(R)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE)&&R!==xn&&!P)}function l(R){if(R==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";R="mediump"}return R==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=e.precision!==void 0?e.precision:"highp";const h=l(c);h!==c&&(console.warn("THREE.WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);const u=e.logarithmicDepthBuffer===!0,d=e.reverseDepthBuffer===!0&&t.has("EXT_clip_control"),f=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),g=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),_=i.getParameter(i.MAX_TEXTURE_SIZE),m=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),p=i.getParameter(i.MAX_VERTEX_ATTRIBS),x=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),M=i.getParameter(i.MAX_VARYING_VECTORS),v=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),A=g>0,E=i.getParameter(i.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:o,textureTypeReadable:a,precision:c,logarithmicDepthBuffer:u,reverseDepthBuffer:d,maxTextures:f,maxVertexTextures:g,maxTextureSize:_,maxCubemapSize:m,maxAttributes:p,maxVertexUniforms:x,maxVaryings:M,maxFragmentUniforms:v,vertexTextures:A,maxSamples:E}}function A0(i){const t=this;let e=null,n=0,s=!1,r=!1;const o=new Kn,a=new qt,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(u,d){const f=u.length!==0||d||n!==0||s;return s=d,n=u.length,f},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(u,d){e=h(u,d,0)},this.setState=function(u,d,f){const g=u.clippingPlanes,_=u.clipIntersection,m=u.clipShadows,p=i.get(u);if(!s||g===null||g.length===0||r&&!m)r?h(null):c();else{const x=r?0:n,M=x*4;let v=p.clippingState||null;l.value=v,v=h(g,d,M,f);for(let A=0;A!==M;++A)v[A]=e[A];p.clippingState=v,this.numIntersection=_?this.numPlanes:0,this.numPlanes+=x}};function c(){l.value!==e&&(l.value=e,l.needsUpdate=n>0),t.numPlanes=n,t.numIntersection=0}function h(u,d,f,g){const _=u!==null?u.length:0;let m=null;if(_!==0){if(m=l.value,g!==!0||m===null){const p=f+_*4,x=d.matrixWorldInverse;a.getNormalMatrix(x),(m===null||m.length<p)&&(m=new Float32Array(p));for(let M=0,v=f;M!==_;++M,v+=4)o.copy(u[M]).applyMatrix4(x,a),o.normal.toArray(m,v),m[v+3]=o.constant}l.value=m,l.needsUpdate=!0}return t.numPlanes=_,t.numIntersection=0,m}}function C0(i){let t=new WeakMap;function e(o,a){return a===Ba?o.mapping=ns:a===ka&&(o.mapping=is),o}function n(o){if(o&&o.isTexture){const a=o.mapping;if(a===Ba||a===ka)if(t.has(o)){const l=t.get(o).texture;return e(l,o.mapping)}else{const l=o.image;if(l&&l.height>0){const c=new kf(l.height);return c.fromEquirectangularTexture(i,o),t.set(o,c),o.addEventListener("dispose",s),e(c.texture,o.mapping)}else return null}}return o}function s(o){const a=o.target;a.removeEventListener("dispose",s);const l=t.get(a);l!==void 0&&(t.delete(a),l.dispose())}function r(){t=new WeakMap}return{get:n,dispose:r}}class Eu extends bu{constructor(t=-1,e=1,n=1,s=-1,r=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=n,this.bottom=s,this.near=r,this.far=o,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,n,s,r,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2;let r=n-t,o=n+t,a=s+e,l=s-e;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,o=r+c*this.view.width,a-=h*this.view.offsetY,l=a-h*this.view.height}this.projectionMatrix.makeOrthographic(r,o,a,l,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}}const ji=4,Tc=[.125,.215,.35,.446,.526,.582],gi=20,jo=new Eu,Ac=new St;let Ko=null,Zo=0,Jo=0,Qo=!1;const mi=(1+Math.sqrt(5))/2,Gi=1/mi,Cc=[new T(-mi,Gi,0),new T(mi,Gi,0),new T(-Gi,0,mi),new T(Gi,0,mi),new T(0,mi,-Gi),new T(0,mi,Gi),new T(-1,1,-1),new T(1,1,-1),new T(-1,1,1),new T(1,1,1)];class fl{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(t,e=0,n=.1,s=100){Ko=this._renderer.getRenderTarget(),Zo=this._renderer.getActiveCubeFace(),Jo=this._renderer.getActiveMipmapLevel(),Qo=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(256);const r=this._allocateTargets();return r.depthBuffer=!0,this._sceneToCubeUV(t,n,s,r),e>0&&this._blur(r,0,0,e),this._applyPMREM(r),this._cleanup(r),r}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Lc(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Pc(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodPlanes.length;t++)this._lodPlanes[t].dispose()}_cleanup(t){this._renderer.setRenderTarget(Ko,Zo,Jo),this._renderer.xr.enabled=Qo,t.scissorTest=!1,Rr(t,0,0,t.width,t.height)}_fromTexture(t,e){t.mapping===ns||t.mapping===is?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),Ko=this._renderer.getRenderTarget(),Zo=this._renderer.getActiveCubeFace(),Jo=this._renderer.getActiveMipmapLevel(),Qo=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const n=e||this._allocateTargets();return this._textureToCubeUV(t,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const t=3*Math.max(this._cubeSize,112),e=4*this._cubeSize,n={magFilter:Mn,minFilter:Mn,generateMipmaps:!1,type:er,format:mn,colorSpace:ii,depthBuffer:!1},s=Rc(t,e,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==e){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Rc(t,e,n);const{_lodMax:r}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=R0(r)),this._blurMaterial=P0(r,t,e)}return s}_compileMaterial(t){const e=new J(this._lodPlanes[0],t);this._renderer.compile(e,jo)}_sceneToCubeUV(t,e,n,s){const a=new tn(90,1,e,n),l=[1,-1,1,1,1,1],c=[1,1,1,-1,-1,-1],h=this._renderer,u=h.autoClear,d=h.toneMapping;h.getClearColor(Ac),h.toneMapping=ei,h.autoClear=!1;const f=new Sn({name:"PMREM.Background",side:Ye,depthWrite:!1,depthTest:!1}),g=new J(new qe,f);let _=!1;const m=t.background;m?m.isColor&&(f.color.copy(m),t.background=null,_=!0):(f.color.copy(Ac),_=!0);for(let p=0;p<6;p++){const x=p%3;x===0?(a.up.set(0,l[p],0),a.lookAt(c[p],0,0)):x===1?(a.up.set(0,0,l[p]),a.lookAt(0,c[p],0)):(a.up.set(0,l[p],0),a.lookAt(0,0,c[p]));const M=this._cubeSize;Rr(s,x*M,p>2?M:0,M,M),h.setRenderTarget(s),_&&h.render(g,a),h.render(t,a)}g.geometry.dispose(),g.material.dispose(),h.toneMapping=d,h.autoClear=u,t.background=m}_textureToCubeUV(t,e){const n=this._renderer,s=t.mapping===ns||t.mapping===is;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=Lc()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Pc());const r=s?this._cubemapMaterial:this._equirectMaterial,o=new J(this._lodPlanes[0],r),a=r.uniforms;a.envMap.value=t;const l=this._cubeSize;Rr(e,0,0,3*l,2*l),n.setRenderTarget(e),n.render(o,jo)}_applyPMREM(t){const e=this._renderer,n=e.autoClear;e.autoClear=!1;const s=this._lodPlanes.length;for(let r=1;r<s;r++){const o=Math.sqrt(this._sigmas[r]*this._sigmas[r]-this._sigmas[r-1]*this._sigmas[r-1]),a=Cc[(s-r-1)%Cc.length];this._blur(t,r-1,r,o,a)}e.autoClear=n}_blur(t,e,n,s,r){const o=this._pingPongRenderTarget;this._halfBlur(t,o,e,n,s,"latitudinal",r),this._halfBlur(o,t,n,n,s,"longitudinal",r)}_halfBlur(t,e,n,s,r,o,a){const l=this._renderer,c=this._blurMaterial;o!=="latitudinal"&&o!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const h=3,u=new J(this._lodPlanes[s],c),d=c.uniforms,f=this._sizeLods[n]-1,g=isFinite(r)?Math.PI/(2*f):2*Math.PI/(2*gi-1),_=r/g,m=isFinite(r)?1+Math.floor(h*_):gi;m>gi&&console.warn(`sigmaRadians, ${r}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${gi}`);const p=[];let x=0;for(let R=0;R<gi;++R){const P=R/_,b=Math.exp(-P*P/2);p.push(b),R===0?x+=b:R<m&&(x+=2*b)}for(let R=0;R<p.length;R++)p[R]=p[R]/x;d.envMap.value=t.texture,d.samples.value=m,d.weights.value=p,d.latitudinal.value=o==="latitudinal",a&&(d.poleAxis.value=a);const{_lodMax:M}=this;d.dTheta.value=g,d.mipInt.value=M-n;const v=this._sizeLods[s],A=3*v*(s>M-ji?s-M+ji:0),E=4*(this._cubeSize-v);Rr(e,A,E,3*v,2*v),l.setRenderTarget(e),l.render(u,jo)}}function R0(i){const t=[],e=[],n=[];let s=i;const r=i-ji+1+Tc.length;for(let o=0;o<r;o++){const a=Math.pow(2,s);e.push(a);let l=1/a;o>i-ji?l=Tc[o-i+ji-1]:o===0&&(l=0),n.push(l);const c=1/(a-2),h=-c,u=1+c,d=[h,h,u,h,u,u,h,h,u,u,h,u],f=6,g=6,_=3,m=2,p=1,x=new Float32Array(_*g*f),M=new Float32Array(m*g*f),v=new Float32Array(p*g*f);for(let E=0;E<f;E++){const R=E%3*2/3-1,P=E>2?0:-1,b=[R,P,0,R+2/3,P,0,R+2/3,P+1,0,R,P,0,R+2/3,P+1,0,R,P+1,0];x.set(b,_*g*E),M.set(d,m*g*E);const y=[E,E,E,E,E,E];v.set(y,p*g*E)}const A=new pe;A.setAttribute("position",new Re(x,_)),A.setAttribute("uv",new Re(M,m)),A.setAttribute("faceIndex",new Re(v,p)),t.push(A),s>ji&&s--}return{lodPlanes:t,sizeLods:e,sigmas:n}}function Rc(i,t,e){const n=new Si(i,t,e);return n.texture.mapping=fo,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function Rr(i,t,e,n,s){i.viewport.set(t,e,n,s),i.scissor.set(t,e,n,s)}function P0(i,t,e){const n=new Float32Array(gi),s=new T(0,1,0);return new nn({name:"SphericalGaussianBlur",defines:{n:gi,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:Nl(),fragmentShader:`

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
		`,blending:ti,depthTest:!1,depthWrite:!1})}function Pc(){return new nn({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Nl(),fragmentShader:`

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
		`,blending:ti,depthTest:!1,depthWrite:!1})}function Lc(){return new nn({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Nl(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:ti,depthTest:!1,depthWrite:!1})}function Nl(){return`

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
	`}function L0(i){let t=new WeakMap,e=null;function n(a){if(a&&a.isTexture){const l=a.mapping,c=l===Ba||l===ka,h=l===ns||l===is;if(c||h){let u=t.get(a);const d=u!==void 0?u.texture.pmremVersion:0;if(a.isRenderTargetTexture&&a.pmremVersion!==d)return e===null&&(e=new fl(i)),u=c?e.fromEquirectangular(a,u):e.fromCubemap(a,u),u.texture.pmremVersion=a.pmremVersion,t.set(a,u),u.texture;if(u!==void 0)return u.texture;{const f=a.image;return c&&f&&f.height>0||h&&f&&s(f)?(e===null&&(e=new fl(i)),u=c?e.fromEquirectangular(a):e.fromCubemap(a),u.texture.pmremVersion=a.pmremVersion,t.set(a,u),a.addEventListener("dispose",r),u.texture):null}}}return a}function s(a){let l=0;const c=6;for(let h=0;h<c;h++)a[h]!==void 0&&l++;return l===c}function r(a){const l=a.target;l.removeEventListener("dispose",r);const c=t.get(l);c!==void 0&&(t.delete(l),c.dispose())}function o(){t=new WeakMap,e!==null&&(e.dispose(),e=null)}return{get:n,dispose:o}}function I0(i){const t={};function e(n){if(t[n]!==void 0)return t[n];let s;switch(n){case"WEBGL_depth_texture":s=i.getExtension("WEBGL_depth_texture")||i.getExtension("MOZ_WEBGL_depth_texture")||i.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":s=i.getExtension("EXT_texture_filter_anisotropic")||i.getExtension("MOZ_EXT_texture_filter_anisotropic")||i.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":s=i.getExtension("WEBGL_compressed_texture_s3tc")||i.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":s=i.getExtension("WEBGL_compressed_texture_pvrtc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:s=i.getExtension(n)}return t[n]=s,s}return{has:function(n){return e(n)!==null},init:function(){e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance"),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture"),e("WEBGL_render_shared_exponent")},get:function(n){const s=e(n);return s===null&&Ts("THREE.WebGLRenderer: "+n+" extension not supported."),s}}}function D0(i,t,e,n){const s={},r=new WeakMap;function o(u){const d=u.target;d.index!==null&&t.remove(d.index);for(const g in d.attributes)t.remove(d.attributes[g]);for(const g in d.morphAttributes){const _=d.morphAttributes[g];for(let m=0,p=_.length;m<p;m++)t.remove(_[m])}d.removeEventListener("dispose",o),delete s[d.id];const f=r.get(d);f&&(t.remove(f),r.delete(d)),n.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,e.memory.geometries--}function a(u,d){return s[d.id]===!0||(d.addEventListener("dispose",o),s[d.id]=!0,e.memory.geometries++),d}function l(u){const d=u.attributes;for(const g in d)t.update(d[g],i.ARRAY_BUFFER);const f=u.morphAttributes;for(const g in f){const _=f[g];for(let m=0,p=_.length;m<p;m++)t.update(_[m],i.ARRAY_BUFFER)}}function c(u){const d=[],f=u.index,g=u.attributes.position;let _=0;if(f!==null){const x=f.array;_=f.version;for(let M=0,v=x.length;M<v;M+=3){const A=x[M+0],E=x[M+1],R=x[M+2];d.push(A,E,E,R,R,A)}}else if(g!==void 0){const x=g.array;_=g.version;for(let M=0,v=x.length/3-1;M<v;M+=3){const A=M+0,E=M+1,R=M+2;d.push(A,E,E,R,R,A)}}else return;const m=new(mu(d)?xu:Mu)(d,1);m.version=_;const p=r.get(u);p&&t.remove(p),r.set(u,m)}function h(u){const d=r.get(u);if(d){const f=u.index;f!==null&&d.version<f.version&&c(u)}else c(u);return r.get(u)}return{get:a,update:l,getWireframeAttribute:h}}function U0(i,t,e){let n;function s(d){n=d}let r,o;function a(d){r=d.type,o=d.bytesPerElement}function l(d,f){i.drawElements(n,f,r,d*o),e.update(f,n,1)}function c(d,f,g){g!==0&&(i.drawElementsInstanced(n,f,r,d*o,g),e.update(f,n,g))}function h(d,f,g){if(g===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,f,0,r,d,0,g);let m=0;for(let p=0;p<g;p++)m+=f[p];e.update(m,n,1)}function u(d,f,g,_){if(g===0)return;const m=t.get("WEBGL_multi_draw");if(m===null)for(let p=0;p<d.length;p++)c(d[p]/o,f[p],_[p]);else{m.multiDrawElementsInstancedWEBGL(n,f,0,r,d,0,_,0,g);let p=0;for(let x=0;x<g;x++)p+=f[x]*_[x];e.update(p,n,1)}}this.setMode=s,this.setIndex=a,this.render=l,this.renderInstances=c,this.renderMultiDraw=h,this.renderMultiDrawInstances=u}function N0(i){const t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,o,a){switch(e.calls++,o){case i.TRIANGLES:e.triangles+=a*(r/3);break;case i.LINES:e.lines+=a*(r/2);break;case i.LINE_STRIP:e.lines+=a*(r-1);break;case i.LINE_LOOP:e.lines+=a*r;break;case i.POINTS:e.points+=a*r;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",o);break}}function s(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:s,update:n}}function O0(i,t,e){const n=new WeakMap,s=new ie;function r(o,a,l){const c=o.morphTargetInfluences,h=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,u=h!==void 0?h.length:0;let d=n.get(a);if(d===void 0||d.count!==u){let b=function(){R.dispose(),n.delete(a),a.removeEventListener("dispose",b)};d!==void 0&&d.texture.dispose();const f=a.morphAttributes.position!==void 0,g=a.morphAttributes.normal!==void 0,_=a.morphAttributes.color!==void 0,m=a.morphAttributes.position||[],p=a.morphAttributes.normal||[],x=a.morphAttributes.color||[];let M=0;f===!0&&(M=1),g===!0&&(M=2),_===!0&&(M=3);let v=a.attributes.position.count*M,A=1;v>t.maxTextureSize&&(A=Math.ceil(v/t.maxTextureSize),v=t.maxTextureSize);const E=new Float32Array(v*A*4*u),R=new vu(E,v,A,u);R.type=xn,R.needsUpdate=!0;const P=M*4;for(let y=0;y<u;y++){const I=m[y],F=p[y],U=x[y],O=v*A*4*y;for(let V=0;V<I.count;V++){const G=V*P;f===!0&&(s.fromBufferAttribute(I,V),E[O+G+0]=s.x,E[O+G+1]=s.y,E[O+G+2]=s.z,E[O+G+3]=0),g===!0&&(s.fromBufferAttribute(F,V),E[O+G+4]=s.x,E[O+G+5]=s.y,E[O+G+6]=s.z,E[O+G+7]=0),_===!0&&(s.fromBufferAttribute(U,V),E[O+G+8]=s.x,E[O+G+9]=s.y,E[O+G+10]=s.z,E[O+G+11]=U.itemSize===4?s.w:1)}}d={count:u,texture:R,size:new H(v,A)},n.set(a,d),a.addEventListener("dispose",b)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)l.getUniforms().setValue(i,"morphTexture",o.morphTexture,e);else{let f=0;for(let _=0;_<c.length;_++)f+=c[_];const g=a.morphTargetsRelative?1:1-f;l.getUniforms().setValue(i,"morphTargetBaseInfluence",g),l.getUniforms().setValue(i,"morphTargetInfluences",c)}l.getUniforms().setValue(i,"morphTargetsTexture",d.texture,e),l.getUniforms().setValue(i,"morphTargetsTextureSize",d.size)}return{update:r}}function F0(i,t,e,n){let s=new WeakMap;function r(l){const c=n.render.frame,h=l.geometry,u=t.get(l,h);if(s.get(u)!==c&&(t.update(u),s.set(u,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",a)===!1&&l.addEventListener("dispose",a),s.get(l)!==c&&(e.update(l.instanceMatrix,i.ARRAY_BUFFER),l.instanceColor!==null&&e.update(l.instanceColor,i.ARRAY_BUFFER),s.set(l,c))),l.isSkinnedMesh){const d=l.skeleton;s.get(d)!==c&&(d.update(),s.set(d,c))}return u}function o(){s=new WeakMap}function a(l){const c=l.target;c.removeEventListener("dispose",a),e.remove(c.instanceMatrix),c.instanceColor!==null&&e.remove(c.instanceColor)}return{update:r,dispose:o}}class Tu extends Ve{constructor(t,e,n,s,r,o,a,l,c,h=Ji){if(h!==Ji&&h!==os)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");n===void 0&&h===Ji&&(n=bi),n===void 0&&h===os&&(n=rs),super(null,s,r,o,a,l,h,n,c),this.isDepthTexture=!0,this.image={width:t,height:e},this.magFilter=a!==void 0?a:en,this.minFilter=l!==void 0?l:en,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.compareFunction=t.compareFunction,this}toJSON(t){const e=super.toJSON(t);return this.compareFunction!==null&&(e.compareFunction=this.compareFunction),e}}const Au=new Ve,Ic=new Tu(1,1),Cu=new vu,Ru=new Sf,Pu=new Su,Dc=[],Uc=[],Nc=new Float32Array(16),Oc=new Float32Array(9),Fc=new Float32Array(4);function hs(i,t,e){const n=i[0];if(n<=0||n>0)return i;const s=t*e;let r=Dc[s];if(r===void 0&&(r=new Float32Array(s),Dc[s]=r),t!==0){n.toArray(r,0);for(let o=1,a=0;o!==t;++o)a+=e,i[o].toArray(r,a)}return r}function Te(i,t){if(i.length!==t.length)return!1;for(let e=0,n=i.length;e<n;e++)if(i[e]!==t[e])return!1;return!0}function Ae(i,t){for(let e=0,n=t.length;e<n;e++)i[e]=t[e]}function go(i,t){let e=Uc[t];e===void 0&&(e=new Int32Array(t),Uc[t]=e);for(let n=0;n!==t;++n)e[n]=i.allocateTextureUnit();return e}function B0(i,t){const e=this.cache;e[0]!==t&&(i.uniform1f(this.addr,t),e[0]=t)}function k0(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Te(e,t))return;i.uniform2fv(this.addr,t),Ae(e,t)}}function z0(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(i.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(Te(e,t))return;i.uniform3fv(this.addr,t),Ae(e,t)}}function H0(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Te(e,t))return;i.uniform4fv(this.addr,t),Ae(e,t)}}function V0(i,t){const e=this.cache,n=t.elements;if(n===void 0){if(Te(e,t))return;i.uniformMatrix2fv(this.addr,!1,t),Ae(e,t)}else{if(Te(e,n))return;Fc.set(n),i.uniformMatrix2fv(this.addr,!1,Fc),Ae(e,n)}}function G0(i,t){const e=this.cache,n=t.elements;if(n===void 0){if(Te(e,t))return;i.uniformMatrix3fv(this.addr,!1,t),Ae(e,t)}else{if(Te(e,n))return;Oc.set(n),i.uniformMatrix3fv(this.addr,!1,Oc),Ae(e,n)}}function W0(i,t){const e=this.cache,n=t.elements;if(n===void 0){if(Te(e,t))return;i.uniformMatrix4fv(this.addr,!1,t),Ae(e,t)}else{if(Te(e,n))return;Nc.set(n),i.uniformMatrix4fv(this.addr,!1,Nc),Ae(e,n)}}function q0(i,t){const e=this.cache;e[0]!==t&&(i.uniform1i(this.addr,t),e[0]=t)}function Y0(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Te(e,t))return;i.uniform2iv(this.addr,t),Ae(e,t)}}function X0(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(Te(e,t))return;i.uniform3iv(this.addr,t),Ae(e,t)}}function $0(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Te(e,t))return;i.uniform4iv(this.addr,t),Ae(e,t)}}function j0(i,t){const e=this.cache;e[0]!==t&&(i.uniform1ui(this.addr,t),e[0]=t)}function K0(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Te(e,t))return;i.uniform2uiv(this.addr,t),Ae(e,t)}}function Z0(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(Te(e,t))return;i.uniform3uiv(this.addr,t),Ae(e,t)}}function J0(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Te(e,t))return;i.uniform4uiv(this.addr,t),Ae(e,t)}}function Q0(i,t,e){const n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_2D_SHADOW?(Ic.compareFunction=pu,r=Ic):r=Au,e.setTexture2D(t||r,s)}function tg(i,t,e){const n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture3D(t||Ru,s)}function eg(i,t,e){const n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTextureCube(t||Pu,s)}function ng(i,t,e){const n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture2DArray(t||Cu,s)}function ig(i){switch(i){case 5126:return B0;case 35664:return k0;case 35665:return z0;case 35666:return H0;case 35674:return V0;case 35675:return G0;case 35676:return W0;case 5124:case 35670:return q0;case 35667:case 35671:return Y0;case 35668:case 35672:return X0;case 35669:case 35673:return $0;case 5125:return j0;case 36294:return K0;case 36295:return Z0;case 36296:return J0;case 35678:case 36198:case 36298:case 36306:case 35682:return Q0;case 35679:case 36299:case 36307:return tg;case 35680:case 36300:case 36308:case 36293:return eg;case 36289:case 36303:case 36311:case 36292:return ng}}function sg(i,t){i.uniform1fv(this.addr,t)}function rg(i,t){const e=hs(t,this.size,2);i.uniform2fv(this.addr,e)}function og(i,t){const e=hs(t,this.size,3);i.uniform3fv(this.addr,e)}function ag(i,t){const e=hs(t,this.size,4);i.uniform4fv(this.addr,e)}function lg(i,t){const e=hs(t,this.size,4);i.uniformMatrix2fv(this.addr,!1,e)}function cg(i,t){const e=hs(t,this.size,9);i.uniformMatrix3fv(this.addr,!1,e)}function hg(i,t){const e=hs(t,this.size,16);i.uniformMatrix4fv(this.addr,!1,e)}function ug(i,t){i.uniform1iv(this.addr,t)}function dg(i,t){i.uniform2iv(this.addr,t)}function fg(i,t){i.uniform3iv(this.addr,t)}function pg(i,t){i.uniform4iv(this.addr,t)}function mg(i,t){i.uniform1uiv(this.addr,t)}function gg(i,t){i.uniform2uiv(this.addr,t)}function vg(i,t){i.uniform3uiv(this.addr,t)}function _g(i,t){i.uniform4uiv(this.addr,t)}function Mg(i,t,e){const n=this.cache,s=t.length,r=go(e,s);Te(n,r)||(i.uniform1iv(this.addr,r),Ae(n,r));for(let o=0;o!==s;++o)e.setTexture2D(t[o]||Au,r[o])}function xg(i,t,e){const n=this.cache,s=t.length,r=go(e,s);Te(n,r)||(i.uniform1iv(this.addr,r),Ae(n,r));for(let o=0;o!==s;++o)e.setTexture3D(t[o]||Ru,r[o])}function yg(i,t,e){const n=this.cache,s=t.length,r=go(e,s);Te(n,r)||(i.uniform1iv(this.addr,r),Ae(n,r));for(let o=0;o!==s;++o)e.setTextureCube(t[o]||Pu,r[o])}function bg(i,t,e){const n=this.cache,s=t.length,r=go(e,s);Te(n,r)||(i.uniform1iv(this.addr,r),Ae(n,r));for(let o=0;o!==s;++o)e.setTexture2DArray(t[o]||Cu,r[o])}function Sg(i){switch(i){case 5126:return sg;case 35664:return rg;case 35665:return og;case 35666:return ag;case 35674:return lg;case 35675:return cg;case 35676:return hg;case 5124:case 35670:return ug;case 35667:case 35671:return dg;case 35668:case 35672:return fg;case 35669:case 35673:return pg;case 5125:return mg;case 36294:return gg;case 36295:return vg;case 36296:return _g;case 35678:case 36198:case 36298:case 36306:case 35682:return Mg;case 35679:case 36299:case 36307:return xg;case 35680:case 36300:case 36308:case 36293:return yg;case 36289:case 36303:case 36311:case 36292:return bg}}class wg{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.setValue=ig(e.type)}}class Eg{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=Sg(e.type)}}class Tg{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,n){const s=this.seq;for(let r=0,o=s.length;r!==o;++r){const a=s[r];a.setValue(t,e[a.id],n)}}}const ta=/(\w+)(\])?(\[|\.)?/g;function Bc(i,t){i.seq.push(t),i.map[t.id]=t}function Ag(i,t,e){const n=i.name,s=n.length;for(ta.lastIndex=0;;){const r=ta.exec(n),o=ta.lastIndex;let a=r[1];const l=r[2]==="]",c=r[3];if(l&&(a=a|0),c===void 0||c==="["&&o+2===s){Bc(e,c===void 0?new wg(a,i,t):new Eg(a,i,t));break}else{let u=e.map[a];u===void 0&&(u=new Tg(a),Bc(e,u)),e=u}}}class Jr{constructor(t,e){this.seq=[],this.map={};const n=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let s=0;s<n;++s){const r=t.getActiveUniform(e,s),o=t.getUniformLocation(e,r.name);Ag(r,o,this)}}setValue(t,e,n,s){const r=this.map[e];r!==void 0&&r.setValue(t,n,s)}setOptional(t,e,n){const s=e[n];s!==void 0&&this.setValue(t,n,s)}static upload(t,e,n,s){for(let r=0,o=e.length;r!==o;++r){const a=e[r],l=n[a.id];l.needsUpdate!==!1&&a.setValue(t,l.value,s)}}static seqWithValue(t,e){const n=[];for(let s=0,r=t.length;s!==r;++s){const o=t[s];o.id in e&&n.push(o)}return n}}function kc(i,t,e){const n=i.createShader(t);return i.shaderSource(n,e),i.compileShader(n),n}const Cg=37297;let Rg=0;function Pg(i,t){const e=i.split(`
`),n=[],s=Math.max(t-6,0),r=Math.min(t+6,e.length);for(let o=s;o<r;o++){const a=o+1;n.push(`${a===t?">":" "} ${a}: ${e[o]}`)}return n.join(`
`)}const zc=new qt;function Lg(i){Qt._getMatrix(zc,Qt.workingColorSpace,i);const t=`mat3( ${zc.elements.map(e=>e.toFixed(4))} )`;switch(Qt.getTransfer(i)){case po:return[t,"LinearTransferOETF"];case ae:return[t,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",i),[t,"LinearTransferOETF"]}}function Hc(i,t,e){const n=i.getShaderParameter(t,i.COMPILE_STATUS),s=i.getShaderInfoLog(t).trim();if(n&&s==="")return"";const r=/ERROR: 0:(\d+)/.exec(s);if(r){const o=parseInt(r[1]);return e.toUpperCase()+`

`+s+`

`+Pg(i.getShaderSource(t),o)}else return s}function Ig(i,t){const e=Lg(t);return[`vec4 ${i}( vec4 value ) {`,`	return ${e[1]}( vec4( value.rgb * ${e[0]}, value.a ) );`,"}"].join(`
`)}function Dg(i,t){let e;switch(t){case Nd:e="Linear";break;case Od:e="Reinhard";break;case Fd:e="Cineon";break;case Bd:e="ACESFilmic";break;case zd:e="AgX";break;case nu:e="Neutral";break;case kd:e="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",t),e="Linear"}return"vec3 "+i+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}const Pr=new T;function Ug(){Qt.getLuminanceCoefficients(Pr);const i=Pr.x.toFixed(4),t=Pr.y.toFixed(4),e=Pr.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${t}, ${e} );`,"	return dot( weights, rgb );","}"].join(`
`)}function Ng(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(As).join(`
`)}function Og(i){const t=[];for(const e in i){const n=i[e];n!==!1&&t.push("#define "+e+" "+n)}return t.join(`
`)}function Fg(i,t){const e={},n=i.getProgramParameter(t,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){const r=i.getActiveAttrib(t,s),o=r.name;let a=1;r.type===i.FLOAT_MAT2&&(a=2),r.type===i.FLOAT_MAT3&&(a=3),r.type===i.FLOAT_MAT4&&(a=4),e[o]={type:r.type,location:i.getAttribLocation(t,o),locationSize:a}}return e}function As(i){return i!==""}function Vc(i,t){const e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return i.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function Gc(i,t){return i.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}const Bg=/^[ \t]*#include +<([\w\d./]+)>/gm;function pl(i){return i.replace(Bg,zg)}const kg=new Map;function zg(i,t){let e=Xt[t];if(e===void 0){const n=kg.get(t);if(n!==void 0)e=Xt[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,n);else throw new Error("Can not resolve #include <"+t+">")}return pl(e)}const Hg=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Wc(i){return i.replace(Hg,Vg)}function Vg(i,t,e,n){let s="";for(let r=parseInt(t);r<parseInt(e);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function qc(i){let t=`precision ${i.precision} float;
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
#define LOW_PRECISION`),t}function Gg(i){let t="SHADOWMAP_TYPE_BASIC";return i.shadowMapType===Jh?t="SHADOWMAP_TYPE_PCF":i.shadowMapType===Qh?t="SHADOWMAP_TYPE_PCF_SOFT":i.shadowMapType===Dn&&(t="SHADOWMAP_TYPE_VSM"),t}function Wg(i){let t="ENVMAP_TYPE_CUBE";if(i.envMap)switch(i.envMapMode){case ns:case is:t="ENVMAP_TYPE_CUBE";break;case fo:t="ENVMAP_TYPE_CUBE_UV";break}return t}function qg(i){let t="ENVMAP_MODE_REFLECTION";if(i.envMap)switch(i.envMapMode){case is:t="ENVMAP_MODE_REFRACTION";break}return t}function Yg(i){let t="ENVMAP_BLENDING_NONE";if(i.envMap)switch(i.combine){case eu:t="ENVMAP_BLENDING_MULTIPLY";break;case Dd:t="ENVMAP_BLENDING_MIX";break;case Ud:t="ENVMAP_BLENDING_ADD";break}return t}function Xg(i){const t=i.envMapCubeUVHeight;if(t===null)return null;const e=Math.log2(t)-2,n=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,e),112)),texelHeight:n,maxMip:e}}function $g(i,t,e,n){const s=i.getContext(),r=e.defines;let o=e.vertexShader,a=e.fragmentShader;const l=Gg(e),c=Wg(e),h=qg(e),u=Yg(e),d=Xg(e),f=Ng(e),g=Og(r),_=s.createProgram();let m,p,x=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(m=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g].filter(As).join(`
`),m.length>0&&(m+=`
`),p=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g].filter(As).join(`
`),p.length>0&&(p+=`
`)):(m=[qc(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.batchingColor?"#define USE_BATCHING_COLOR":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.instancingMorph?"#define USE_INSTANCING_MORPH":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+h:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(As).join(`
`),p=[qc(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+c:"",e.envMap?"#define "+h:"",e.envMap?"#define "+u:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.dispersion?"#define USE_DISPERSION":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor||e.batchingColor?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==ei?"#define TONE_MAPPING":"",e.toneMapping!==ei?Xt.tonemapping_pars_fragment:"",e.toneMapping!==ei?Dg("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",Xt.colorspace_pars_fragment,Ig("linearToOutputTexel",e.outputColorSpace),Ug(),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(As).join(`
`)),o=pl(o),o=Vc(o,e),o=Gc(o,e),a=pl(a),a=Vc(a,e),a=Gc(a,e),o=Wc(o),a=Wc(a),e.isRawShaderMaterial!==!0&&(x=`#version 300 es
`,m=[f,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,p=["#define varying in",e.glslVersion===sc?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===sc?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+p);const M=x+m+o,v=x+p+a,A=kc(s,s.VERTEX_SHADER,M),E=kc(s,s.FRAGMENT_SHADER,v);s.attachShader(_,A),s.attachShader(_,E),e.index0AttributeName!==void 0?s.bindAttribLocation(_,0,e.index0AttributeName):e.morphTargets===!0&&s.bindAttribLocation(_,0,"position"),s.linkProgram(_);function R(I){if(i.debug.checkShaderErrors){const F=s.getProgramInfoLog(_).trim(),U=s.getShaderInfoLog(A).trim(),O=s.getShaderInfoLog(E).trim();let V=!0,G=!0;if(s.getProgramParameter(_,s.LINK_STATUS)===!1)if(V=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,_,A,E);else{const D=Hc(s,A,"vertex"),N=Hc(s,E,"fragment");console.error("THREE.WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(_,s.VALIDATE_STATUS)+`

Material Name: `+I.name+`
Material Type: `+I.type+`

Program Info Log: `+F+`
`+D+`
`+N)}else F!==""?console.warn("THREE.WebGLProgram: Program Info Log:",F):(U===""||O==="")&&(G=!1);G&&(I.diagnostics={runnable:V,programLog:F,vertexShader:{log:U,prefix:m},fragmentShader:{log:O,prefix:p}})}s.deleteShader(A),s.deleteShader(E),P=new Jr(s,_),b=Fg(s,_)}let P;this.getUniforms=function(){return P===void 0&&R(this),P};let b;this.getAttributes=function(){return b===void 0&&R(this),b};let y=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return y===!1&&(y=s.getProgramParameter(_,Cg)),y},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(_),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=Rg++,this.cacheKey=t,this.usedTimes=1,this.program=_,this.vertexShader=A,this.fragmentShader=E,this}let jg=0;class Kg{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t){const e=t.vertexShader,n=t.fragmentShader,s=this._getShaderStage(e),r=this._getShaderStage(n),o=this._getShaderCacheForMaterial(t);return o.has(s)===!1&&(o.add(s),s.usedTimes++),o.has(r)===!1&&(o.add(r),r.usedTimes++),this}remove(t){const e=this.materialCache.get(t);for(const n of e)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(t),this}getVertexShaderID(t){return this._getShaderStage(t.vertexShader).id}getFragmentShaderID(t){return this._getShaderStage(t.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){const e=this.materialCache;let n=e.get(t);return n===void 0&&(n=new Set,e.set(t,n)),n}_getShaderStage(t){const e=this.shaderCache;let n=e.get(t);return n===void 0&&(n=new Zg(t),e.set(t,n)),n}}class Zg{constructor(t){this.id=jg++,this.code=t,this.usedTimes=0}}function Jg(i,t,e,n,s,r,o){const a=new Dl,l=new Kg,c=new Set,h=[],u=s.logarithmicDepthBuffer,d=s.vertexTextures;let f=s.precision;const g={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function _(b){return c.add(b),b===0?"uv":`uv${b}`}function m(b,y,I,F,U){const O=F.fog,V=U.geometry,G=b.isMeshStandardMaterial?F.environment:null,D=(b.isMeshStandardMaterial?e:t).get(b.envMap||G),N=D&&D.mapping===fo?D.image.height:null,j=g[b.type];b.precision!==null&&(f=s.getMaxPrecision(b.precision),f!==b.precision&&console.warn("THREE.WebGLProgram.getParameters:",b.precision,"not supported, using",f,"instead."));const it=V.morphAttributes.position||V.morphAttributes.normal||V.morphAttributes.color,ut=it!==void 0?it.length:0;let Dt=0;V.morphAttributes.position!==void 0&&(Dt=1),V.morphAttributes.normal!==void 0&&(Dt=2),V.morphAttributes.color!==void 0&&(Dt=3);let $t,Q,st,ft;if(j){const oe=vn[j];$t=oe.vertexShader,Q=oe.fragmentShader}else $t=b.vertexShader,Q=b.fragmentShader,l.update(b),st=l.getVertexShaderID(b),ft=l.getFragmentShaderID(b);const rt=i.getRenderTarget(),Pt=i.state.buffers.depth.getReversed(),Lt=U.isInstancedMesh===!0,_t=U.isBatchedMesh===!0,Et=!!b.map,$=!!b.matcap,at=!!D,L=!!b.aoMap,Tt=!!b.lightMap,ot=!!b.bumpMap,bt=!!b.normalMap,lt=!!b.displacementMap,Bt=!!b.emissiveMap,dt=!!b.metalnessMap,C=!!b.roughnessMap,S=b.anisotropy>0,W=b.clearcoat>0,K=b.dispersion>0,nt=b.iridescence>0,tt=b.sheen>0,It=b.transmission>0,mt=S&&!!b.anisotropyMap,wt=W&&!!b.clearcoatMap,Kt=W&&!!b.clearcoatNormalMap,ct=W&&!!b.clearcoatRoughnessMap,At=nt&&!!b.iridescenceMap,kt=nt&&!!b.iridescenceThicknessMap,zt=tt&&!!b.sheenColorMap,Ct=tt&&!!b.sheenRoughnessMap,Zt=!!b.specularMap,Yt=!!b.specularColorMap,ce=!!b.specularIntensityMap,B=It&&!!b.transmissionMap,gt=It&&!!b.thicknessMap,Z=!!b.gradientMap,et=!!b.alphaMap,yt=b.alphaTest>0,Mt=!!b.alphaHash,Vt=!!b.extensions;let ge=ei;b.toneMapped&&(rt===null||rt.isXRRenderTarget===!0)&&(ge=i.toneMapping);const Fe={shaderID:j,shaderType:b.type,shaderName:b.name,vertexShader:$t,fragmentShader:Q,defines:b.defines,customVertexShaderID:st,customFragmentShaderID:ft,isRawShaderMaterial:b.isRawShaderMaterial===!0,glslVersion:b.glslVersion,precision:f,batching:_t,batchingColor:_t&&U._colorsTexture!==null,instancing:Lt,instancingColor:Lt&&U.instanceColor!==null,instancingMorph:Lt&&U.morphTexture!==null,supportsVertexTextures:d,outputColorSpace:rt===null?i.outputColorSpace:rt.isXRRenderTarget===!0?rt.texture.colorSpace:ii,alphaToCoverage:!!b.alphaToCoverage,map:Et,matcap:$,envMap:at,envMapMode:at&&D.mapping,envMapCubeUVHeight:N,aoMap:L,lightMap:Tt,bumpMap:ot,normalMap:bt,displacementMap:d&&lt,emissiveMap:Bt,normalMapObjectSpace:bt&&b.normalMapType===Wd,normalMapTangentSpace:bt&&b.normalMapType===fu,metalnessMap:dt,roughnessMap:C,anisotropy:S,anisotropyMap:mt,clearcoat:W,clearcoatMap:wt,clearcoatNormalMap:Kt,clearcoatRoughnessMap:ct,dispersion:K,iridescence:nt,iridescenceMap:At,iridescenceThicknessMap:kt,sheen:tt,sheenColorMap:zt,sheenRoughnessMap:Ct,specularMap:Zt,specularColorMap:Yt,specularIntensityMap:ce,transmission:It,transmissionMap:B,thicknessMap:gt,gradientMap:Z,opaque:b.transparent===!1&&b.blending===xi&&b.alphaToCoverage===!1,alphaMap:et,alphaTest:yt,alphaHash:Mt,combine:b.combine,mapUv:Et&&_(b.map.channel),aoMapUv:L&&_(b.aoMap.channel),lightMapUv:Tt&&_(b.lightMap.channel),bumpMapUv:ot&&_(b.bumpMap.channel),normalMapUv:bt&&_(b.normalMap.channel),displacementMapUv:lt&&_(b.displacementMap.channel),emissiveMapUv:Bt&&_(b.emissiveMap.channel),metalnessMapUv:dt&&_(b.metalnessMap.channel),roughnessMapUv:C&&_(b.roughnessMap.channel),anisotropyMapUv:mt&&_(b.anisotropyMap.channel),clearcoatMapUv:wt&&_(b.clearcoatMap.channel),clearcoatNormalMapUv:Kt&&_(b.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:ct&&_(b.clearcoatRoughnessMap.channel),iridescenceMapUv:At&&_(b.iridescenceMap.channel),iridescenceThicknessMapUv:kt&&_(b.iridescenceThicknessMap.channel),sheenColorMapUv:zt&&_(b.sheenColorMap.channel),sheenRoughnessMapUv:Ct&&_(b.sheenRoughnessMap.channel),specularMapUv:Zt&&_(b.specularMap.channel),specularColorMapUv:Yt&&_(b.specularColorMap.channel),specularIntensityMapUv:ce&&_(b.specularIntensityMap.channel),transmissionMapUv:B&&_(b.transmissionMap.channel),thicknessMapUv:gt&&_(b.thicknessMap.channel),alphaMapUv:et&&_(b.alphaMap.channel),vertexTangents:!!V.attributes.tangent&&(bt||S),vertexColors:b.vertexColors,vertexAlphas:b.vertexColors===!0&&!!V.attributes.color&&V.attributes.color.itemSize===4,pointsUvs:U.isPoints===!0&&!!V.attributes.uv&&(Et||et),fog:!!O,useFog:b.fog===!0,fogExp2:!!O&&O.isFogExp2,flatShading:b.flatShading===!0,sizeAttenuation:b.sizeAttenuation===!0,logarithmicDepthBuffer:u,reverseDepthBuffer:Pt,skinning:U.isSkinnedMesh===!0,morphTargets:V.morphAttributes.position!==void 0,morphNormals:V.morphAttributes.normal!==void 0,morphColors:V.morphAttributes.color!==void 0,morphTargetsCount:ut,morphTextureStride:Dt,numDirLights:y.directional.length,numPointLights:y.point.length,numSpotLights:y.spot.length,numSpotLightMaps:y.spotLightMap.length,numRectAreaLights:y.rectArea.length,numHemiLights:y.hemi.length,numDirLightShadows:y.directionalShadowMap.length,numPointLightShadows:y.pointShadowMap.length,numSpotLightShadows:y.spotShadowMap.length,numSpotLightShadowsWithMaps:y.numSpotLightShadowsWithMaps,numLightProbes:y.numLightProbes,numClippingPlanes:o.numPlanes,numClipIntersection:o.numIntersection,dithering:b.dithering,shadowMapEnabled:i.shadowMap.enabled&&I.length>0,shadowMapType:i.shadowMap.type,toneMapping:ge,decodeVideoTexture:Et&&b.map.isVideoTexture===!0&&Qt.getTransfer(b.map.colorSpace)===ae,decodeVideoTextureEmissive:Bt&&b.emissiveMap.isVideoTexture===!0&&Qt.getTransfer(b.emissiveMap.colorSpace)===ae,premultipliedAlpha:b.premultipliedAlpha,doubleSided:b.side===je,flipSided:b.side===Ye,useDepthPacking:b.depthPacking>=0,depthPacking:b.depthPacking||0,index0AttributeName:b.index0AttributeName,extensionClipCullDistance:Vt&&b.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(Vt&&b.extensions.multiDraw===!0||_t)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:b.customProgramCacheKey()};return Fe.vertexUv1s=c.has(1),Fe.vertexUv2s=c.has(2),Fe.vertexUv3s=c.has(3),c.clear(),Fe}function p(b){const y=[];if(b.shaderID?y.push(b.shaderID):(y.push(b.customVertexShaderID),y.push(b.customFragmentShaderID)),b.defines!==void 0)for(const I in b.defines)y.push(I),y.push(b.defines[I]);return b.isRawShaderMaterial===!1&&(x(y,b),M(y,b),y.push(i.outputColorSpace)),y.push(b.customProgramCacheKey),y.join()}function x(b,y){b.push(y.precision),b.push(y.outputColorSpace),b.push(y.envMapMode),b.push(y.envMapCubeUVHeight),b.push(y.mapUv),b.push(y.alphaMapUv),b.push(y.lightMapUv),b.push(y.aoMapUv),b.push(y.bumpMapUv),b.push(y.normalMapUv),b.push(y.displacementMapUv),b.push(y.emissiveMapUv),b.push(y.metalnessMapUv),b.push(y.roughnessMapUv),b.push(y.anisotropyMapUv),b.push(y.clearcoatMapUv),b.push(y.clearcoatNormalMapUv),b.push(y.clearcoatRoughnessMapUv),b.push(y.iridescenceMapUv),b.push(y.iridescenceThicknessMapUv),b.push(y.sheenColorMapUv),b.push(y.sheenRoughnessMapUv),b.push(y.specularMapUv),b.push(y.specularColorMapUv),b.push(y.specularIntensityMapUv),b.push(y.transmissionMapUv),b.push(y.thicknessMapUv),b.push(y.combine),b.push(y.fogExp2),b.push(y.sizeAttenuation),b.push(y.morphTargetsCount),b.push(y.morphAttributeCount),b.push(y.numDirLights),b.push(y.numPointLights),b.push(y.numSpotLights),b.push(y.numSpotLightMaps),b.push(y.numHemiLights),b.push(y.numRectAreaLights),b.push(y.numDirLightShadows),b.push(y.numPointLightShadows),b.push(y.numSpotLightShadows),b.push(y.numSpotLightShadowsWithMaps),b.push(y.numLightProbes),b.push(y.shadowMapType),b.push(y.toneMapping),b.push(y.numClippingPlanes),b.push(y.numClipIntersection),b.push(y.depthPacking)}function M(b,y){a.disableAll(),y.supportsVertexTextures&&a.enable(0),y.instancing&&a.enable(1),y.instancingColor&&a.enable(2),y.instancingMorph&&a.enable(3),y.matcap&&a.enable(4),y.envMap&&a.enable(5),y.normalMapObjectSpace&&a.enable(6),y.normalMapTangentSpace&&a.enable(7),y.clearcoat&&a.enable(8),y.iridescence&&a.enable(9),y.alphaTest&&a.enable(10),y.vertexColors&&a.enable(11),y.vertexAlphas&&a.enable(12),y.vertexUv1s&&a.enable(13),y.vertexUv2s&&a.enable(14),y.vertexUv3s&&a.enable(15),y.vertexTangents&&a.enable(16),y.anisotropy&&a.enable(17),y.alphaHash&&a.enable(18),y.batching&&a.enable(19),y.dispersion&&a.enable(20),y.batchingColor&&a.enable(21),b.push(a.mask),a.disableAll(),y.fog&&a.enable(0),y.useFog&&a.enable(1),y.flatShading&&a.enable(2),y.logarithmicDepthBuffer&&a.enable(3),y.reverseDepthBuffer&&a.enable(4),y.skinning&&a.enable(5),y.morphTargets&&a.enable(6),y.morphNormals&&a.enable(7),y.morphColors&&a.enable(8),y.premultipliedAlpha&&a.enable(9),y.shadowMapEnabled&&a.enable(10),y.doubleSided&&a.enable(11),y.flipSided&&a.enable(12),y.useDepthPacking&&a.enable(13),y.dithering&&a.enable(14),y.transmission&&a.enable(15),y.sheen&&a.enable(16),y.opaque&&a.enable(17),y.pointsUvs&&a.enable(18),y.decodeVideoTexture&&a.enable(19),y.decodeVideoTextureEmissive&&a.enable(20),y.alphaToCoverage&&a.enable(21),b.push(a.mask)}function v(b){const y=g[b.type];let I;if(y){const F=vn[y];I=Nf.clone(F.uniforms)}else I=b.uniforms;return I}function A(b,y){let I;for(let F=0,U=h.length;F<U;F++){const O=h[F];if(O.cacheKey===y){I=O,++I.usedTimes;break}}return I===void 0&&(I=new $g(i,y,b,r),h.push(I)),I}function E(b){if(--b.usedTimes===0){const y=h.indexOf(b);h[y]=h[h.length-1],h.pop(),b.destroy()}}function R(b){l.remove(b)}function P(){l.dispose()}return{getParameters:m,getProgramCacheKey:p,getUniforms:v,acquireProgram:A,releaseProgram:E,releaseShaderCache:R,programs:h,dispose:P}}function Qg(){let i=new WeakMap;function t(o){return i.has(o)}function e(o){let a=i.get(o);return a===void 0&&(a={},i.set(o,a)),a}function n(o){i.delete(o)}function s(o,a,l){i.get(o)[a]=l}function r(){i=new WeakMap}return{has:t,get:e,remove:n,update:s,dispose:r}}function tv(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.material.id!==t.material.id?i.material.id-t.material.id:i.z!==t.z?i.z-t.z:i.id-t.id}function Yc(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.z!==t.z?t.z-i.z:i.id-t.id}function Xc(){const i=[];let t=0;const e=[],n=[],s=[];function r(){t=0,e.length=0,n.length=0,s.length=0}function o(u,d,f,g,_,m){let p=i[t];return p===void 0?(p={id:u.id,object:u,geometry:d,material:f,groupOrder:g,renderOrder:u.renderOrder,z:_,group:m},i[t]=p):(p.id=u.id,p.object=u,p.geometry=d,p.material=f,p.groupOrder=g,p.renderOrder=u.renderOrder,p.z=_,p.group=m),t++,p}function a(u,d,f,g,_,m){const p=o(u,d,f,g,_,m);f.transmission>0?n.push(p):f.transparent===!0?s.push(p):e.push(p)}function l(u,d,f,g,_,m){const p=o(u,d,f,g,_,m);f.transmission>0?n.unshift(p):f.transparent===!0?s.unshift(p):e.unshift(p)}function c(u,d){e.length>1&&e.sort(u||tv),n.length>1&&n.sort(d||Yc),s.length>1&&s.sort(d||Yc)}function h(){for(let u=t,d=i.length;u<d;u++){const f=i[u];if(f.id===null)break;f.id=null,f.object=null,f.geometry=null,f.material=null,f.group=null}}return{opaque:e,transmissive:n,transparent:s,init:r,push:a,unshift:l,finish:h,sort:c}}function ev(){let i=new WeakMap;function t(n,s){const r=i.get(n);let o;return r===void 0?(o=new Xc,i.set(n,[o])):s>=r.length?(o=new Xc,r.push(o)):o=r[s],o}function e(){i=new WeakMap}return{get:t,dispose:e}}function nv(){const i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"DirectionalLight":e={direction:new T,color:new St};break;case"SpotLight":e={position:new T,direction:new T,color:new St,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new T,color:new St,distance:0,decay:0};break;case"HemisphereLight":e={direction:new T,skyColor:new St,groundColor:new St};break;case"RectAreaLight":e={color:new St,position:new T,halfWidth:new T,halfHeight:new T};break}return i[t.id]=e,e}}}function iv(){const i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"DirectionalLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new H};break;case"SpotLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new H};break;case"PointLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new H,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[t.id]=e,e}}}let sv=0;function rv(i,t){return(t.castShadow?2:0)-(i.castShadow?2:0)+(t.map?1:0)-(i.map?1:0)}function ov(i){const t=new nv,e=iv(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new T);const s=new T,r=new Jt,o=new Jt;function a(c){let h=0,u=0,d=0;for(let b=0;b<9;b++)n.probe[b].set(0,0,0);let f=0,g=0,_=0,m=0,p=0,x=0,M=0,v=0,A=0,E=0,R=0;c.sort(rv);for(let b=0,y=c.length;b<y;b++){const I=c[b],F=I.color,U=I.intensity,O=I.distance,V=I.shadow&&I.shadow.map?I.shadow.map.texture:null;if(I.isAmbientLight)h+=F.r*U,u+=F.g*U,d+=F.b*U;else if(I.isLightProbe){for(let G=0;G<9;G++)n.probe[G].addScaledVector(I.sh.coefficients[G],U);R++}else if(I.isDirectionalLight){const G=t.get(I);if(G.color.copy(I.color).multiplyScalar(I.intensity),I.castShadow){const D=I.shadow,N=e.get(I);N.shadowIntensity=D.intensity,N.shadowBias=D.bias,N.shadowNormalBias=D.normalBias,N.shadowRadius=D.radius,N.shadowMapSize=D.mapSize,n.directionalShadow[f]=N,n.directionalShadowMap[f]=V,n.directionalShadowMatrix[f]=I.shadow.matrix,x++}n.directional[f]=G,f++}else if(I.isSpotLight){const G=t.get(I);G.position.setFromMatrixPosition(I.matrixWorld),G.color.copy(F).multiplyScalar(U),G.distance=O,G.coneCos=Math.cos(I.angle),G.penumbraCos=Math.cos(I.angle*(1-I.penumbra)),G.decay=I.decay,n.spot[_]=G;const D=I.shadow;if(I.map&&(n.spotLightMap[A]=I.map,A++,D.updateMatrices(I),I.castShadow&&E++),n.spotLightMatrix[_]=D.matrix,I.castShadow){const N=e.get(I);N.shadowIntensity=D.intensity,N.shadowBias=D.bias,N.shadowNormalBias=D.normalBias,N.shadowRadius=D.radius,N.shadowMapSize=D.mapSize,n.spotShadow[_]=N,n.spotShadowMap[_]=V,v++}_++}else if(I.isRectAreaLight){const G=t.get(I);G.color.copy(F).multiplyScalar(U),G.halfWidth.set(I.width*.5,0,0),G.halfHeight.set(0,I.height*.5,0),n.rectArea[m]=G,m++}else if(I.isPointLight){const G=t.get(I);if(G.color.copy(I.color).multiplyScalar(I.intensity),G.distance=I.distance,G.decay=I.decay,I.castShadow){const D=I.shadow,N=e.get(I);N.shadowIntensity=D.intensity,N.shadowBias=D.bias,N.shadowNormalBias=D.normalBias,N.shadowRadius=D.radius,N.shadowMapSize=D.mapSize,N.shadowCameraNear=D.camera.near,N.shadowCameraFar=D.camera.far,n.pointShadow[g]=N,n.pointShadowMap[g]=V,n.pointShadowMatrix[g]=I.shadow.matrix,M++}n.point[g]=G,g++}else if(I.isHemisphereLight){const G=t.get(I);G.skyColor.copy(I.color).multiplyScalar(U),G.groundColor.copy(I.groundColor).multiplyScalar(U),n.hemi[p]=G,p++}}m>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=pt.LTC_FLOAT_1,n.rectAreaLTC2=pt.LTC_FLOAT_2):(n.rectAreaLTC1=pt.LTC_HALF_1,n.rectAreaLTC2=pt.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=u,n.ambient[2]=d;const P=n.hash;(P.directionalLength!==f||P.pointLength!==g||P.spotLength!==_||P.rectAreaLength!==m||P.hemiLength!==p||P.numDirectionalShadows!==x||P.numPointShadows!==M||P.numSpotShadows!==v||P.numSpotMaps!==A||P.numLightProbes!==R)&&(n.directional.length=f,n.spot.length=_,n.rectArea.length=m,n.point.length=g,n.hemi.length=p,n.directionalShadow.length=x,n.directionalShadowMap.length=x,n.pointShadow.length=M,n.pointShadowMap.length=M,n.spotShadow.length=v,n.spotShadowMap.length=v,n.directionalShadowMatrix.length=x,n.pointShadowMatrix.length=M,n.spotLightMatrix.length=v+A-E,n.spotLightMap.length=A,n.numSpotLightShadowsWithMaps=E,n.numLightProbes=R,P.directionalLength=f,P.pointLength=g,P.spotLength=_,P.rectAreaLength=m,P.hemiLength=p,P.numDirectionalShadows=x,P.numPointShadows=M,P.numSpotShadows=v,P.numSpotMaps=A,P.numLightProbes=R,n.version=sv++)}function l(c,h){let u=0,d=0,f=0,g=0,_=0;const m=h.matrixWorldInverse;for(let p=0,x=c.length;p<x;p++){const M=c[p];if(M.isDirectionalLight){const v=n.directional[u];v.direction.setFromMatrixPosition(M.matrixWorld),s.setFromMatrixPosition(M.target.matrixWorld),v.direction.sub(s),v.direction.transformDirection(m),u++}else if(M.isSpotLight){const v=n.spot[f];v.position.setFromMatrixPosition(M.matrixWorld),v.position.applyMatrix4(m),v.direction.setFromMatrixPosition(M.matrixWorld),s.setFromMatrixPosition(M.target.matrixWorld),v.direction.sub(s),v.direction.transformDirection(m),f++}else if(M.isRectAreaLight){const v=n.rectArea[g];v.position.setFromMatrixPosition(M.matrixWorld),v.position.applyMatrix4(m),o.identity(),r.copy(M.matrixWorld),r.premultiply(m),o.extractRotation(r),v.halfWidth.set(M.width*.5,0,0),v.halfHeight.set(0,M.height*.5,0),v.halfWidth.applyMatrix4(o),v.halfHeight.applyMatrix4(o),g++}else if(M.isPointLight){const v=n.point[d];v.position.setFromMatrixPosition(M.matrixWorld),v.position.applyMatrix4(m),d++}else if(M.isHemisphereLight){const v=n.hemi[_];v.direction.setFromMatrixPosition(M.matrixWorld),v.direction.transformDirection(m),_++}}}return{setup:a,setupView:l,state:n}}function $c(i){const t=new ov(i),e=[],n=[];function s(h){c.camera=h,e.length=0,n.length=0}function r(h){e.push(h)}function o(h){n.push(h)}function a(){t.setup(e)}function l(h){t.setupView(e,h)}const c={lightsArray:e,shadowsArray:n,camera:null,lights:t,transmissionRenderTarget:{}};return{init:s,state:c,setupLights:a,setupLightsView:l,pushLight:r,pushShadow:o}}function av(i){let t=new WeakMap;function e(s,r=0){const o=t.get(s);let a;return o===void 0?(a=new $c(i),t.set(s,[a])):r>=o.length?(a=new $c(i),o.push(a)):a=o[r],a}function n(){t=new WeakMap}return{get:e,dispose:n}}class lv extends cs{static get type(){return"MeshDepthMaterial"}constructor(t){super(),this.isMeshDepthMaterial=!0,this.depthPacking=Vd,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}}class cv extends cs{static get type(){return"MeshDistanceMaterial"}constructor(t){super(),this.isMeshDistanceMaterial=!0,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}}const hv=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,uv=`uniform sampler2D shadow_pass;
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
}`;function dv(i,t,e){let n=new Ul;const s=new H,r=new H,o=new ie,a=new lv({depthPacking:Gd}),l=new cv,c={},h=e.maxTextureSize,u={[bn]:Ye,[Ye]:bn,[je]:je},d=new nn({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new H},radius:{value:4}},vertexShader:hv,fragmentShader:uv}),f=d.clone();f.defines.HORIZONTAL_PASS=1;const g=new pe;g.setAttribute("position",new Re(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const _=new J(g,d),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Jh;let p=this.type;this.render=function(E,R,P){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||E.length===0)return;const b=i.getRenderTarget(),y=i.getActiveCubeFace(),I=i.getActiveMipmapLevel(),F=i.state;F.setBlending(ti),F.buffers.color.setClear(1,1,1,1),F.buffers.depth.setTest(!0),F.setScissorTest(!1);const U=p!==Dn&&this.type===Dn,O=p===Dn&&this.type!==Dn;for(let V=0,G=E.length;V<G;V++){const D=E[V],N=D.shadow;if(N===void 0){console.warn("THREE.WebGLShadowMap:",D,"has no shadow.");continue}if(N.autoUpdate===!1&&N.needsUpdate===!1)continue;s.copy(N.mapSize);const j=N.getFrameExtents();if(s.multiply(j),r.copy(N.mapSize),(s.x>h||s.y>h)&&(s.x>h&&(r.x=Math.floor(h/j.x),s.x=r.x*j.x,N.mapSize.x=r.x),s.y>h&&(r.y=Math.floor(h/j.y),s.y=r.y*j.y,N.mapSize.y=r.y)),N.map===null||U===!0||O===!0){const ut=this.type!==Dn?{minFilter:en,magFilter:en}:{};N.map!==null&&N.map.dispose(),N.map=new Si(s.x,s.y,ut),N.map.texture.name=D.name+".shadowMap",N.camera.updateProjectionMatrix()}i.setRenderTarget(N.map),i.clear();const it=N.getViewportCount();for(let ut=0;ut<it;ut++){const Dt=N.getViewport(ut);o.set(r.x*Dt.x,r.y*Dt.y,r.x*Dt.z,r.y*Dt.w),F.viewport(o),N.updateMatrices(D,ut),n=N.getFrustum(),v(R,P,N.camera,D,this.type)}N.isPointLightShadow!==!0&&this.type===Dn&&x(N,P),N.needsUpdate=!1}p=this.type,m.needsUpdate=!1,i.setRenderTarget(b,y,I)};function x(E,R){const P=t.update(_);d.defines.VSM_SAMPLES!==E.blurSamples&&(d.defines.VSM_SAMPLES=E.blurSamples,f.defines.VSM_SAMPLES=E.blurSamples,d.needsUpdate=!0,f.needsUpdate=!0),E.mapPass===null&&(E.mapPass=new Si(s.x,s.y)),d.uniforms.shadow_pass.value=E.map.texture,d.uniforms.resolution.value=E.mapSize,d.uniforms.radius.value=E.radius,i.setRenderTarget(E.mapPass),i.clear(),i.renderBufferDirect(R,null,P,d,_,null),f.uniforms.shadow_pass.value=E.mapPass.texture,f.uniforms.resolution.value=E.mapSize,f.uniforms.radius.value=E.radius,i.setRenderTarget(E.map),i.clear(),i.renderBufferDirect(R,null,P,f,_,null)}function M(E,R,P,b){let y=null;const I=P.isPointLight===!0?E.customDistanceMaterial:E.customDepthMaterial;if(I!==void 0)y=I;else if(y=P.isPointLight===!0?l:a,i.localClippingEnabled&&R.clipShadows===!0&&Array.isArray(R.clippingPlanes)&&R.clippingPlanes.length!==0||R.displacementMap&&R.displacementScale!==0||R.alphaMap&&R.alphaTest>0||R.map&&R.alphaTest>0){const F=y.uuid,U=R.uuid;let O=c[F];O===void 0&&(O={},c[F]=O);let V=O[U];V===void 0&&(V=y.clone(),O[U]=V,R.addEventListener("dispose",A)),y=V}if(y.visible=R.visible,y.wireframe=R.wireframe,b===Dn?y.side=R.shadowSide!==null?R.shadowSide:R.side:y.side=R.shadowSide!==null?R.shadowSide:u[R.side],y.alphaMap=R.alphaMap,y.alphaTest=R.alphaTest,y.map=R.map,y.clipShadows=R.clipShadows,y.clippingPlanes=R.clippingPlanes,y.clipIntersection=R.clipIntersection,y.displacementMap=R.displacementMap,y.displacementScale=R.displacementScale,y.displacementBias=R.displacementBias,y.wireframeLinewidth=R.wireframeLinewidth,y.linewidth=R.linewidth,P.isPointLight===!0&&y.isMeshDistanceMaterial===!0){const F=i.properties.get(y);F.light=P}return y}function v(E,R,P,b,y){if(E.visible===!1)return;if(E.layers.test(R.layers)&&(E.isMesh||E.isLine||E.isPoints)&&(E.castShadow||E.receiveShadow&&y===Dn)&&(!E.frustumCulled||n.intersectsObject(E))){E.modelViewMatrix.multiplyMatrices(P.matrixWorldInverse,E.matrixWorld);const U=t.update(E),O=E.material;if(Array.isArray(O)){const V=U.groups;for(let G=0,D=V.length;G<D;G++){const N=V[G],j=O[N.materialIndex];if(j&&j.visible){const it=M(E,j,b,y);E.onBeforeShadow(i,E,R,P,U,it,N),i.renderBufferDirect(P,null,U,it,E,N),E.onAfterShadow(i,E,R,P,U,it,N)}}}else if(O.visible){const V=M(E,O,b,y);E.onBeforeShadow(i,E,R,P,U,V,null),i.renderBufferDirect(P,null,U,V,E,null),E.onAfterShadow(i,E,R,P,U,V,null)}}const F=E.children;for(let U=0,O=F.length;U<O;U++)v(F[U],R,P,b,y)}function A(E){E.target.removeEventListener("dispose",A);for(const P in c){const b=c[P],y=E.target.uuid;y in b&&(b[y].dispose(),delete b[y])}}}const fv={[La]:Ia,[Da]:Oa,[Ua]:Fa,[es]:Na,[Ia]:La,[Oa]:Da,[Fa]:Ua,[Na]:es};function pv(i,t){function e(){let B=!1;const gt=new ie;let Z=null;const et=new ie(0,0,0,0);return{setMask:function(yt){Z!==yt&&!B&&(i.colorMask(yt,yt,yt,yt),Z=yt)},setLocked:function(yt){B=yt},setClear:function(yt,Mt,Vt,ge,Fe){Fe===!0&&(yt*=ge,Mt*=ge,Vt*=ge),gt.set(yt,Mt,Vt,ge),et.equals(gt)===!1&&(i.clearColor(yt,Mt,Vt,ge),et.copy(gt))},reset:function(){B=!1,Z=null,et.set(-1,0,0,0)}}}function n(){let B=!1,gt=!1,Z=null,et=null,yt=null;return{setReversed:function(Mt){if(gt!==Mt){const Vt=t.get("EXT_clip_control");gt?Vt.clipControlEXT(Vt.LOWER_LEFT_EXT,Vt.ZERO_TO_ONE_EXT):Vt.clipControlEXT(Vt.LOWER_LEFT_EXT,Vt.NEGATIVE_ONE_TO_ONE_EXT);const ge=yt;yt=null,this.setClear(ge)}gt=Mt},getReversed:function(){return gt},setTest:function(Mt){Mt?rt(i.DEPTH_TEST):Pt(i.DEPTH_TEST)},setMask:function(Mt){Z!==Mt&&!B&&(i.depthMask(Mt),Z=Mt)},setFunc:function(Mt){if(gt&&(Mt=fv[Mt]),et!==Mt){switch(Mt){case La:i.depthFunc(i.NEVER);break;case Ia:i.depthFunc(i.ALWAYS);break;case Da:i.depthFunc(i.LESS);break;case es:i.depthFunc(i.LEQUAL);break;case Ua:i.depthFunc(i.EQUAL);break;case Na:i.depthFunc(i.GEQUAL);break;case Oa:i.depthFunc(i.GREATER);break;case Fa:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}et=Mt}},setLocked:function(Mt){B=Mt},setClear:function(Mt){yt!==Mt&&(gt&&(Mt=1-Mt),i.clearDepth(Mt),yt=Mt)},reset:function(){B=!1,Z=null,et=null,yt=null,gt=!1}}}function s(){let B=!1,gt=null,Z=null,et=null,yt=null,Mt=null,Vt=null,ge=null,Fe=null;return{setTest:function(oe){B||(oe?rt(i.STENCIL_TEST):Pt(i.STENCIL_TEST))},setMask:function(oe){gt!==oe&&!B&&(i.stencilMask(oe),gt=oe)},setFunc:function(oe,cn,En){(Z!==oe||et!==cn||yt!==En)&&(i.stencilFunc(oe,cn,En),Z=oe,et=cn,yt=En)},setOp:function(oe,cn,En){(Mt!==oe||Vt!==cn||ge!==En)&&(i.stencilOp(oe,cn,En),Mt=oe,Vt=cn,ge=En)},setLocked:function(oe){B=oe},setClear:function(oe){Fe!==oe&&(i.clearStencil(oe),Fe=oe)},reset:function(){B=!1,gt=null,Z=null,et=null,yt=null,Mt=null,Vt=null,ge=null,Fe=null}}}const r=new e,o=new n,a=new s,l=new WeakMap,c=new WeakMap;let h={},u={},d=new WeakMap,f=[],g=null,_=!1,m=null,p=null,x=null,M=null,v=null,A=null,E=null,R=new St(0,0,0),P=0,b=!1,y=null,I=null,F=null,U=null,O=null;const V=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let G=!1,D=0;const N=i.getParameter(i.VERSION);N.indexOf("WebGL")!==-1?(D=parseFloat(/^WebGL (\d)/.exec(N)[1]),G=D>=1):N.indexOf("OpenGL ES")!==-1&&(D=parseFloat(/^OpenGL ES (\d)/.exec(N)[1]),G=D>=2);let j=null,it={};const ut=i.getParameter(i.SCISSOR_BOX),Dt=i.getParameter(i.VIEWPORT),$t=new ie().fromArray(ut),Q=new ie().fromArray(Dt);function st(B,gt,Z,et){const yt=new Uint8Array(4),Mt=i.createTexture();i.bindTexture(B,Mt),i.texParameteri(B,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(B,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let Vt=0;Vt<Z;Vt++)B===i.TEXTURE_3D||B===i.TEXTURE_2D_ARRAY?i.texImage3D(gt,0,i.RGBA,1,1,et,0,i.RGBA,i.UNSIGNED_BYTE,yt):i.texImage2D(gt+Vt,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,yt);return Mt}const ft={};ft[i.TEXTURE_2D]=st(i.TEXTURE_2D,i.TEXTURE_2D,1),ft[i.TEXTURE_CUBE_MAP]=st(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),ft[i.TEXTURE_2D_ARRAY]=st(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),ft[i.TEXTURE_3D]=st(i.TEXTURE_3D,i.TEXTURE_3D,1,1),r.setClear(0,0,0,1),o.setClear(1),a.setClear(0),rt(i.DEPTH_TEST),o.setFunc(es),ot(!1),bt(Ql),rt(i.CULL_FACE),L(ti);function rt(B){h[B]!==!0&&(i.enable(B),h[B]=!0)}function Pt(B){h[B]!==!1&&(i.disable(B),h[B]=!1)}function Lt(B,gt){return u[B]!==gt?(i.bindFramebuffer(B,gt),u[B]=gt,B===i.DRAW_FRAMEBUFFER&&(u[i.FRAMEBUFFER]=gt),B===i.FRAMEBUFFER&&(u[i.DRAW_FRAMEBUFFER]=gt),!0):!1}function _t(B,gt){let Z=f,et=!1;if(B){Z=d.get(gt),Z===void 0&&(Z=[],d.set(gt,Z));const yt=B.textures;if(Z.length!==yt.length||Z[0]!==i.COLOR_ATTACHMENT0){for(let Mt=0,Vt=yt.length;Mt<Vt;Mt++)Z[Mt]=i.COLOR_ATTACHMENT0+Mt;Z.length=yt.length,et=!0}}else Z[0]!==i.BACK&&(Z[0]=i.BACK,et=!0);et&&i.drawBuffers(Z)}function Et(B){return g!==B?(i.useProgram(B),g=B,!0):!1}const $={[_n]:i.FUNC_ADD,[Md]:i.FUNC_SUBTRACT,[xd]:i.FUNC_REVERSE_SUBTRACT};$[yd]=i.MIN,$[bd]=i.MAX;const at={[no]:i.ZERO,[yi]:i.ONE,[tu]:i.SRC_COLOR,[Pa]:i.SRC_ALPHA,[Cd]:i.SRC_ALPHA_SATURATE,[Td]:i.DST_COLOR,[wd]:i.DST_ALPHA,[Sd]:i.ONE_MINUS_SRC_COLOR,[qs]:i.ONE_MINUS_SRC_ALPHA,[Ad]:i.ONE_MINUS_DST_COLOR,[Ed]:i.ONE_MINUS_DST_ALPHA,[Rd]:i.CONSTANT_COLOR,[Pd]:i.ONE_MINUS_CONSTANT_COLOR,[Ld]:i.CONSTANT_ALPHA,[Id]:i.ONE_MINUS_CONSTANT_ALPHA};function L(B,gt,Z,et,yt,Mt,Vt,ge,Fe,oe){if(B===ti){_===!0&&(Pt(i.BLEND),_=!1);return}if(_===!1&&(rt(i.BLEND),_=!0),B!==uo){if(B!==m||oe!==b){if((p!==_n||v!==_n)&&(i.blendEquation(i.FUNC_ADD),p=_n,v=_n),oe)switch(B){case xi:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case Ws:i.blendFunc(i.ONE,i.ONE);break;case tc:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case ec:i.blendFuncSeparate(i.ZERO,i.SRC_COLOR,i.ZERO,i.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",B);break}else switch(B){case xi:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case Ws:i.blendFunc(i.SRC_ALPHA,i.ONE);break;case tc:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case ec:i.blendFunc(i.ZERO,i.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",B);break}x=null,M=null,A=null,E=null,R.set(0,0,0),P=0,m=B,b=oe}return}yt=yt||gt,Mt=Mt||Z,Vt=Vt||et,(gt!==p||yt!==v)&&(i.blendEquationSeparate($[gt],$[yt]),p=gt,v=yt),(Z!==x||et!==M||Mt!==A||Vt!==E)&&(i.blendFuncSeparate(at[Z],at[et],at[Mt],at[Vt]),x=Z,M=et,A=Mt,E=Vt),(ge.equals(R)===!1||Fe!==P)&&(i.blendColor(ge.r,ge.g,ge.b,Fe),R.copy(ge),P=Fe),m=B,b=!1}function Tt(B,gt){B.side===je?Pt(i.CULL_FACE):rt(i.CULL_FACE);let Z=B.side===Ye;gt&&(Z=!Z),ot(Z),B.blending===xi&&B.transparent===!1?L(ti):L(B.blending,B.blendEquation,B.blendSrc,B.blendDst,B.blendEquationAlpha,B.blendSrcAlpha,B.blendDstAlpha,B.blendColor,B.blendAlpha,B.premultipliedAlpha),o.setFunc(B.depthFunc),o.setTest(B.depthTest),o.setMask(B.depthWrite),r.setMask(B.colorWrite);const et=B.stencilWrite;a.setTest(et),et&&(a.setMask(B.stencilWriteMask),a.setFunc(B.stencilFunc,B.stencilRef,B.stencilFuncMask),a.setOp(B.stencilFail,B.stencilZFail,B.stencilZPass)),Bt(B.polygonOffset,B.polygonOffsetFactor,B.polygonOffsetUnits),B.alphaToCoverage===!0?rt(i.SAMPLE_ALPHA_TO_COVERAGE):Pt(i.SAMPLE_ALPHA_TO_COVERAGE)}function ot(B){y!==B&&(B?i.frontFace(i.CW):i.frontFace(i.CCW),y=B)}function bt(B){B!==vd?(rt(i.CULL_FACE),B!==I&&(B===Ql?i.cullFace(i.BACK):B===_d?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):Pt(i.CULL_FACE),I=B}function lt(B){B!==F&&(G&&i.lineWidth(B),F=B)}function Bt(B,gt,Z){B?(rt(i.POLYGON_OFFSET_FILL),(U!==gt||O!==Z)&&(i.polygonOffset(gt,Z),U=gt,O=Z)):Pt(i.POLYGON_OFFSET_FILL)}function dt(B){B?rt(i.SCISSOR_TEST):Pt(i.SCISSOR_TEST)}function C(B){B===void 0&&(B=i.TEXTURE0+V-1),j!==B&&(i.activeTexture(B),j=B)}function S(B,gt,Z){Z===void 0&&(j===null?Z=i.TEXTURE0+V-1:Z=j);let et=it[Z];et===void 0&&(et={type:void 0,texture:void 0},it[Z]=et),(et.type!==B||et.texture!==gt)&&(j!==Z&&(i.activeTexture(Z),j=Z),i.bindTexture(B,gt||ft[B]),et.type=B,et.texture=gt)}function W(){const B=it[j];B!==void 0&&B.type!==void 0&&(i.bindTexture(B.type,null),B.type=void 0,B.texture=void 0)}function K(){try{i.compressedTexImage2D.apply(i,arguments)}catch(B){console.error("THREE.WebGLState:",B)}}function nt(){try{i.compressedTexImage3D.apply(i,arguments)}catch(B){console.error("THREE.WebGLState:",B)}}function tt(){try{i.texSubImage2D.apply(i,arguments)}catch(B){console.error("THREE.WebGLState:",B)}}function It(){try{i.texSubImage3D.apply(i,arguments)}catch(B){console.error("THREE.WebGLState:",B)}}function mt(){try{i.compressedTexSubImage2D.apply(i,arguments)}catch(B){console.error("THREE.WebGLState:",B)}}function wt(){try{i.compressedTexSubImage3D.apply(i,arguments)}catch(B){console.error("THREE.WebGLState:",B)}}function Kt(){try{i.texStorage2D.apply(i,arguments)}catch(B){console.error("THREE.WebGLState:",B)}}function ct(){try{i.texStorage3D.apply(i,arguments)}catch(B){console.error("THREE.WebGLState:",B)}}function At(){try{i.texImage2D.apply(i,arguments)}catch(B){console.error("THREE.WebGLState:",B)}}function kt(){try{i.texImage3D.apply(i,arguments)}catch(B){console.error("THREE.WebGLState:",B)}}function zt(B){$t.equals(B)===!1&&(i.scissor(B.x,B.y,B.z,B.w),$t.copy(B))}function Ct(B){Q.equals(B)===!1&&(i.viewport(B.x,B.y,B.z,B.w),Q.copy(B))}function Zt(B,gt){let Z=c.get(gt);Z===void 0&&(Z=new WeakMap,c.set(gt,Z));let et=Z.get(B);et===void 0&&(et=i.getUniformBlockIndex(gt,B.name),Z.set(B,et))}function Yt(B,gt){const et=c.get(gt).get(B);l.get(gt)!==et&&(i.uniformBlockBinding(gt,et,B.__bindingPointIndex),l.set(gt,et))}function ce(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),o.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),h={},j=null,it={},u={},d=new WeakMap,f=[],g=null,_=!1,m=null,p=null,x=null,M=null,v=null,A=null,E=null,R=new St(0,0,0),P=0,b=!1,y=null,I=null,F=null,U=null,O=null,$t.set(0,0,i.canvas.width,i.canvas.height),Q.set(0,0,i.canvas.width,i.canvas.height),r.reset(),o.reset(),a.reset()}return{buffers:{color:r,depth:o,stencil:a},enable:rt,disable:Pt,bindFramebuffer:Lt,drawBuffers:_t,useProgram:Et,setBlending:L,setMaterial:Tt,setFlipSided:ot,setCullFace:bt,setLineWidth:lt,setPolygonOffset:Bt,setScissorTest:dt,activeTexture:C,bindTexture:S,unbindTexture:W,compressedTexImage2D:K,compressedTexImage3D:nt,texImage2D:At,texImage3D:kt,updateUBOMapping:Zt,uniformBlockBinding:Yt,texStorage2D:Kt,texStorage3D:ct,texSubImage2D:tt,texSubImage3D:It,compressedTexSubImage2D:mt,compressedTexSubImage3D:wt,scissor:zt,viewport:Ct,reset:ce}}function jc(i,t,e,n){const s=mv(n);switch(e){case au:return i*t;case cu:return i*t;case hu:return i*t*2;case Al:return i*t/s.components*s.byteLength;case Cl:return i*t/s.components*s.byteLength;case uu:return i*t*2/s.components*s.byteLength;case Rl:return i*t*2/s.components*s.byteLength;case lu:return i*t*3/s.components*s.byteLength;case mn:return i*t*4/s.components*s.byteLength;case Pl:return i*t*4/s.components*s.byteLength;case Xr:case $r:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case jr:case Kr:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case Va:case Wa:return Math.max(i,16)*Math.max(t,8)/4;case Ha:case Ga:return Math.max(i,8)*Math.max(t,8)/2;case qa:case Ya:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case Xa:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case $a:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case ja:return Math.floor((i+4)/5)*Math.floor((t+3)/4)*16;case Ka:return Math.floor((i+4)/5)*Math.floor((t+4)/5)*16;case Za:return Math.floor((i+5)/6)*Math.floor((t+4)/5)*16;case Ja:return Math.floor((i+5)/6)*Math.floor((t+5)/6)*16;case Qa:return Math.floor((i+7)/8)*Math.floor((t+4)/5)*16;case tl:return Math.floor((i+7)/8)*Math.floor((t+5)/6)*16;case el:return Math.floor((i+7)/8)*Math.floor((t+7)/8)*16;case nl:return Math.floor((i+9)/10)*Math.floor((t+4)/5)*16;case il:return Math.floor((i+9)/10)*Math.floor((t+5)/6)*16;case sl:return Math.floor((i+9)/10)*Math.floor((t+7)/8)*16;case rl:return Math.floor((i+9)/10)*Math.floor((t+9)/10)*16;case ol:return Math.floor((i+11)/12)*Math.floor((t+9)/10)*16;case al:return Math.floor((i+11)/12)*Math.floor((t+11)/12)*16;case Zr:case ll:case cl:return Math.ceil(i/4)*Math.ceil(t/4)*16;case du:case hl:return Math.ceil(i/4)*Math.ceil(t/4)*8;case ul:case dl:return Math.ceil(i/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${e} format.`)}function mv(i){switch(i){case On:case su:return{byteLength:1,components:1};case Ys:case ru:case er:return{byteLength:2,components:1};case El:case Tl:return{byteLength:2,components:4};case bi:case wl:case xn:return{byteLength:4,components:1};case ou:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${i}.`)}function gv(i,t,e,n,s,r,o){const a=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new H,h=new WeakMap;let u;const d=new WeakMap;let f=!1;try{f=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function g(C,S){return f?new OffscreenCanvas(C,S):so("canvas")}function _(C,S,W){let K=1;const nt=dt(C);if((nt.width>W||nt.height>W)&&(K=W/Math.max(nt.width,nt.height)),K<1)if(typeof HTMLImageElement<"u"&&C instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&C instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&C instanceof ImageBitmap||typeof VideoFrame<"u"&&C instanceof VideoFrame){const tt=Math.floor(K*nt.width),It=Math.floor(K*nt.height);u===void 0&&(u=g(tt,It));const mt=S?g(tt,It):u;return mt.width=tt,mt.height=It,mt.getContext("2d").drawImage(C,0,0,tt,It),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+nt.width+"x"+nt.height+") to ("+tt+"x"+It+")."),mt}else return"data"in C&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+nt.width+"x"+nt.height+")."),C;return C}function m(C){return C.generateMipmaps}function p(C){i.generateMipmap(C)}function x(C){return C.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:C.isWebGL3DRenderTarget?i.TEXTURE_3D:C.isWebGLArrayRenderTarget||C.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function M(C,S,W,K,nt=!1){if(C!==null){if(i[C]!==void 0)return i[C];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+C+"'")}let tt=S;if(S===i.RED&&(W===i.FLOAT&&(tt=i.R32F),W===i.HALF_FLOAT&&(tt=i.R16F),W===i.UNSIGNED_BYTE&&(tt=i.R8)),S===i.RED_INTEGER&&(W===i.UNSIGNED_BYTE&&(tt=i.R8UI),W===i.UNSIGNED_SHORT&&(tt=i.R16UI),W===i.UNSIGNED_INT&&(tt=i.R32UI),W===i.BYTE&&(tt=i.R8I),W===i.SHORT&&(tt=i.R16I),W===i.INT&&(tt=i.R32I)),S===i.RG&&(W===i.FLOAT&&(tt=i.RG32F),W===i.HALF_FLOAT&&(tt=i.RG16F),W===i.UNSIGNED_BYTE&&(tt=i.RG8)),S===i.RG_INTEGER&&(W===i.UNSIGNED_BYTE&&(tt=i.RG8UI),W===i.UNSIGNED_SHORT&&(tt=i.RG16UI),W===i.UNSIGNED_INT&&(tt=i.RG32UI),W===i.BYTE&&(tt=i.RG8I),W===i.SHORT&&(tt=i.RG16I),W===i.INT&&(tt=i.RG32I)),S===i.RGB_INTEGER&&(W===i.UNSIGNED_BYTE&&(tt=i.RGB8UI),W===i.UNSIGNED_SHORT&&(tt=i.RGB16UI),W===i.UNSIGNED_INT&&(tt=i.RGB32UI),W===i.BYTE&&(tt=i.RGB8I),W===i.SHORT&&(tt=i.RGB16I),W===i.INT&&(tt=i.RGB32I)),S===i.RGBA_INTEGER&&(W===i.UNSIGNED_BYTE&&(tt=i.RGBA8UI),W===i.UNSIGNED_SHORT&&(tt=i.RGBA16UI),W===i.UNSIGNED_INT&&(tt=i.RGBA32UI),W===i.BYTE&&(tt=i.RGBA8I),W===i.SHORT&&(tt=i.RGBA16I),W===i.INT&&(tt=i.RGBA32I)),S===i.RGB&&W===i.UNSIGNED_INT_5_9_9_9_REV&&(tt=i.RGB9_E5),S===i.RGBA){const It=nt?po:Qt.getTransfer(K);W===i.FLOAT&&(tt=i.RGBA32F),W===i.HALF_FLOAT&&(tt=i.RGBA16F),W===i.UNSIGNED_BYTE&&(tt=It===ae?i.SRGB8_ALPHA8:i.RGBA8),W===i.UNSIGNED_SHORT_4_4_4_4&&(tt=i.RGBA4),W===i.UNSIGNED_SHORT_5_5_5_1&&(tt=i.RGB5_A1)}return(tt===i.R16F||tt===i.R32F||tt===i.RG16F||tt===i.RG32F||tt===i.RGBA16F||tt===i.RGBA32F)&&t.get("EXT_color_buffer_float"),tt}function v(C,S){let W;return C?S===null||S===bi||S===rs?W=i.DEPTH24_STENCIL8:S===xn?W=i.DEPTH32F_STENCIL8:S===Ys&&(W=i.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):S===null||S===bi||S===rs?W=i.DEPTH_COMPONENT24:S===xn?W=i.DEPTH_COMPONENT32F:S===Ys&&(W=i.DEPTH_COMPONENT16),W}function A(C,S){return m(C)===!0||C.isFramebufferTexture&&C.minFilter!==en&&C.minFilter!==Mn?Math.log2(Math.max(S.width,S.height))+1:C.mipmaps!==void 0&&C.mipmaps.length>0?C.mipmaps.length:C.isCompressedTexture&&Array.isArray(C.image)?S.mipmaps.length:1}function E(C){const S=C.target;S.removeEventListener("dispose",E),P(S),S.isVideoTexture&&h.delete(S)}function R(C){const S=C.target;S.removeEventListener("dispose",R),y(S)}function P(C){const S=n.get(C);if(S.__webglInit===void 0)return;const W=C.source,K=d.get(W);if(K){const nt=K[S.__cacheKey];nt.usedTimes--,nt.usedTimes===0&&b(C),Object.keys(K).length===0&&d.delete(W)}n.remove(C)}function b(C){const S=n.get(C);i.deleteTexture(S.__webglTexture);const W=C.source,K=d.get(W);delete K[S.__cacheKey],o.memory.textures--}function y(C){const S=n.get(C);if(C.depthTexture&&(C.depthTexture.dispose(),n.remove(C.depthTexture)),C.isWebGLCubeRenderTarget)for(let K=0;K<6;K++){if(Array.isArray(S.__webglFramebuffer[K]))for(let nt=0;nt<S.__webglFramebuffer[K].length;nt++)i.deleteFramebuffer(S.__webglFramebuffer[K][nt]);else i.deleteFramebuffer(S.__webglFramebuffer[K]);S.__webglDepthbuffer&&i.deleteRenderbuffer(S.__webglDepthbuffer[K])}else{if(Array.isArray(S.__webglFramebuffer))for(let K=0;K<S.__webglFramebuffer.length;K++)i.deleteFramebuffer(S.__webglFramebuffer[K]);else i.deleteFramebuffer(S.__webglFramebuffer);if(S.__webglDepthbuffer&&i.deleteRenderbuffer(S.__webglDepthbuffer),S.__webglMultisampledFramebuffer&&i.deleteFramebuffer(S.__webglMultisampledFramebuffer),S.__webglColorRenderbuffer)for(let K=0;K<S.__webglColorRenderbuffer.length;K++)S.__webglColorRenderbuffer[K]&&i.deleteRenderbuffer(S.__webglColorRenderbuffer[K]);S.__webglDepthRenderbuffer&&i.deleteRenderbuffer(S.__webglDepthRenderbuffer)}const W=C.textures;for(let K=0,nt=W.length;K<nt;K++){const tt=n.get(W[K]);tt.__webglTexture&&(i.deleteTexture(tt.__webglTexture),o.memory.textures--),n.remove(W[K])}n.remove(C)}let I=0;function F(){I=0}function U(){const C=I;return C>=s.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+C+" texture units while this GPU supports only "+s.maxTextures),I+=1,C}function O(C){const S=[];return S.push(C.wrapS),S.push(C.wrapT),S.push(C.wrapR||0),S.push(C.magFilter),S.push(C.minFilter),S.push(C.anisotropy),S.push(C.internalFormat),S.push(C.format),S.push(C.type),S.push(C.generateMipmaps),S.push(C.premultiplyAlpha),S.push(C.flipY),S.push(C.unpackAlignment),S.push(C.colorSpace),S.join()}function V(C,S){const W=n.get(C);if(C.isVideoTexture&&lt(C),C.isRenderTargetTexture===!1&&C.version>0&&W.__version!==C.version){const K=C.image;if(K===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(K.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{Q(W,C,S);return}}e.bindTexture(i.TEXTURE_2D,W.__webglTexture,i.TEXTURE0+S)}function G(C,S){const W=n.get(C);if(C.version>0&&W.__version!==C.version){Q(W,C,S);return}e.bindTexture(i.TEXTURE_2D_ARRAY,W.__webglTexture,i.TEXTURE0+S)}function D(C,S){const W=n.get(C);if(C.version>0&&W.__version!==C.version){Q(W,C,S);return}e.bindTexture(i.TEXTURE_3D,W.__webglTexture,i.TEXTURE0+S)}function N(C,S){const W=n.get(C);if(C.version>0&&W.__version!==C.version){st(W,C,S);return}e.bindTexture(i.TEXTURE_CUBE_MAP,W.__webglTexture,i.TEXTURE0+S)}const j={[ss]:i.REPEAT,[vi]:i.CLAMP_TO_EDGE,[za]:i.MIRRORED_REPEAT},it={[en]:i.NEAREST,[Hd]:i.NEAREST_MIPMAP_NEAREST,[hr]:i.NEAREST_MIPMAP_LINEAR,[Mn]:i.LINEAR,[Co]:i.LINEAR_MIPMAP_NEAREST,[_i]:i.LINEAR_MIPMAP_LINEAR},ut={[qd]:i.NEVER,[Zd]:i.ALWAYS,[Yd]:i.LESS,[pu]:i.LEQUAL,[Xd]:i.EQUAL,[Kd]:i.GEQUAL,[$d]:i.GREATER,[jd]:i.NOTEQUAL};function Dt(C,S){if(S.type===xn&&t.has("OES_texture_float_linear")===!1&&(S.magFilter===Mn||S.magFilter===Co||S.magFilter===hr||S.magFilter===_i||S.minFilter===Mn||S.minFilter===Co||S.minFilter===hr||S.minFilter===_i)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(C,i.TEXTURE_WRAP_S,j[S.wrapS]),i.texParameteri(C,i.TEXTURE_WRAP_T,j[S.wrapT]),(C===i.TEXTURE_3D||C===i.TEXTURE_2D_ARRAY)&&i.texParameteri(C,i.TEXTURE_WRAP_R,j[S.wrapR]),i.texParameteri(C,i.TEXTURE_MAG_FILTER,it[S.magFilter]),i.texParameteri(C,i.TEXTURE_MIN_FILTER,it[S.minFilter]),S.compareFunction&&(i.texParameteri(C,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(C,i.TEXTURE_COMPARE_FUNC,ut[S.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(S.magFilter===en||S.minFilter!==hr&&S.minFilter!==_i||S.type===xn&&t.has("OES_texture_float_linear")===!1)return;if(S.anisotropy>1||n.get(S).__currentAnisotropy){const W=t.get("EXT_texture_filter_anisotropic");i.texParameterf(C,W.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(S.anisotropy,s.getMaxAnisotropy())),n.get(S).__currentAnisotropy=S.anisotropy}}}function $t(C,S){let W=!1;C.__webglInit===void 0&&(C.__webglInit=!0,S.addEventListener("dispose",E));const K=S.source;let nt=d.get(K);nt===void 0&&(nt={},d.set(K,nt));const tt=O(S);if(tt!==C.__cacheKey){nt[tt]===void 0&&(nt[tt]={texture:i.createTexture(),usedTimes:0},o.memory.textures++,W=!0),nt[tt].usedTimes++;const It=nt[C.__cacheKey];It!==void 0&&(nt[C.__cacheKey].usedTimes--,It.usedTimes===0&&b(S)),C.__cacheKey=tt,C.__webglTexture=nt[tt].texture}return W}function Q(C,S,W){let K=i.TEXTURE_2D;(S.isDataArrayTexture||S.isCompressedArrayTexture)&&(K=i.TEXTURE_2D_ARRAY),S.isData3DTexture&&(K=i.TEXTURE_3D);const nt=$t(C,S),tt=S.source;e.bindTexture(K,C.__webglTexture,i.TEXTURE0+W);const It=n.get(tt);if(tt.version!==It.__version||nt===!0){e.activeTexture(i.TEXTURE0+W);const mt=Qt.getPrimaries(Qt.workingColorSpace),wt=S.colorSpace===Zn?null:Qt.getPrimaries(S.colorSpace),Kt=S.colorSpace===Zn||mt===wt?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,S.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,S.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,S.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,Kt);let ct=_(S.image,!1,s.maxTextureSize);ct=Bt(S,ct);const At=r.convert(S.format,S.colorSpace),kt=r.convert(S.type);let zt=M(S.internalFormat,At,kt,S.colorSpace,S.isVideoTexture);Dt(K,S);let Ct;const Zt=S.mipmaps,Yt=S.isVideoTexture!==!0,ce=It.__version===void 0||nt===!0,B=tt.dataReady,gt=A(S,ct);if(S.isDepthTexture)zt=v(S.format===os,S.type),ce&&(Yt?e.texStorage2D(i.TEXTURE_2D,1,zt,ct.width,ct.height):e.texImage2D(i.TEXTURE_2D,0,zt,ct.width,ct.height,0,At,kt,null));else if(S.isDataTexture)if(Zt.length>0){Yt&&ce&&e.texStorage2D(i.TEXTURE_2D,gt,zt,Zt[0].width,Zt[0].height);for(let Z=0,et=Zt.length;Z<et;Z++)Ct=Zt[Z],Yt?B&&e.texSubImage2D(i.TEXTURE_2D,Z,0,0,Ct.width,Ct.height,At,kt,Ct.data):e.texImage2D(i.TEXTURE_2D,Z,zt,Ct.width,Ct.height,0,At,kt,Ct.data);S.generateMipmaps=!1}else Yt?(ce&&e.texStorage2D(i.TEXTURE_2D,gt,zt,ct.width,ct.height),B&&e.texSubImage2D(i.TEXTURE_2D,0,0,0,ct.width,ct.height,At,kt,ct.data)):e.texImage2D(i.TEXTURE_2D,0,zt,ct.width,ct.height,0,At,kt,ct.data);else if(S.isCompressedTexture)if(S.isCompressedArrayTexture){Yt&&ce&&e.texStorage3D(i.TEXTURE_2D_ARRAY,gt,zt,Zt[0].width,Zt[0].height,ct.depth);for(let Z=0,et=Zt.length;Z<et;Z++)if(Ct=Zt[Z],S.format!==mn)if(At!==null)if(Yt){if(B)if(S.layerUpdates.size>0){const yt=jc(Ct.width,Ct.height,S.format,S.type);for(const Mt of S.layerUpdates){const Vt=Ct.data.subarray(Mt*yt/Ct.data.BYTES_PER_ELEMENT,(Mt+1)*yt/Ct.data.BYTES_PER_ELEMENT);e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,Z,0,0,Mt,Ct.width,Ct.height,1,At,Vt)}S.clearLayerUpdates()}else e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,Z,0,0,0,Ct.width,Ct.height,ct.depth,At,Ct.data)}else e.compressedTexImage3D(i.TEXTURE_2D_ARRAY,Z,zt,Ct.width,Ct.height,ct.depth,0,Ct.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Yt?B&&e.texSubImage3D(i.TEXTURE_2D_ARRAY,Z,0,0,0,Ct.width,Ct.height,ct.depth,At,kt,Ct.data):e.texImage3D(i.TEXTURE_2D_ARRAY,Z,zt,Ct.width,Ct.height,ct.depth,0,At,kt,Ct.data)}else{Yt&&ce&&e.texStorage2D(i.TEXTURE_2D,gt,zt,Zt[0].width,Zt[0].height);for(let Z=0,et=Zt.length;Z<et;Z++)Ct=Zt[Z],S.format!==mn?At!==null?Yt?B&&e.compressedTexSubImage2D(i.TEXTURE_2D,Z,0,0,Ct.width,Ct.height,At,Ct.data):e.compressedTexImage2D(i.TEXTURE_2D,Z,zt,Ct.width,Ct.height,0,Ct.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Yt?B&&e.texSubImage2D(i.TEXTURE_2D,Z,0,0,Ct.width,Ct.height,At,kt,Ct.data):e.texImage2D(i.TEXTURE_2D,Z,zt,Ct.width,Ct.height,0,At,kt,Ct.data)}else if(S.isDataArrayTexture)if(Yt){if(ce&&e.texStorage3D(i.TEXTURE_2D_ARRAY,gt,zt,ct.width,ct.height,ct.depth),B)if(S.layerUpdates.size>0){const Z=jc(ct.width,ct.height,S.format,S.type);for(const et of S.layerUpdates){const yt=ct.data.subarray(et*Z/ct.data.BYTES_PER_ELEMENT,(et+1)*Z/ct.data.BYTES_PER_ELEMENT);e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,et,ct.width,ct.height,1,At,kt,yt)}S.clearLayerUpdates()}else e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,ct.width,ct.height,ct.depth,At,kt,ct.data)}else e.texImage3D(i.TEXTURE_2D_ARRAY,0,zt,ct.width,ct.height,ct.depth,0,At,kt,ct.data);else if(S.isData3DTexture)Yt?(ce&&e.texStorage3D(i.TEXTURE_3D,gt,zt,ct.width,ct.height,ct.depth),B&&e.texSubImage3D(i.TEXTURE_3D,0,0,0,0,ct.width,ct.height,ct.depth,At,kt,ct.data)):e.texImage3D(i.TEXTURE_3D,0,zt,ct.width,ct.height,ct.depth,0,At,kt,ct.data);else if(S.isFramebufferTexture){if(ce)if(Yt)e.texStorage2D(i.TEXTURE_2D,gt,zt,ct.width,ct.height);else{let Z=ct.width,et=ct.height;for(let yt=0;yt<gt;yt++)e.texImage2D(i.TEXTURE_2D,yt,zt,Z,et,0,At,kt,null),Z>>=1,et>>=1}}else if(Zt.length>0){if(Yt&&ce){const Z=dt(Zt[0]);e.texStorage2D(i.TEXTURE_2D,gt,zt,Z.width,Z.height)}for(let Z=0,et=Zt.length;Z<et;Z++)Ct=Zt[Z],Yt?B&&e.texSubImage2D(i.TEXTURE_2D,Z,0,0,At,kt,Ct):e.texImage2D(i.TEXTURE_2D,Z,zt,At,kt,Ct);S.generateMipmaps=!1}else if(Yt){if(ce){const Z=dt(ct);e.texStorage2D(i.TEXTURE_2D,gt,zt,Z.width,Z.height)}B&&e.texSubImage2D(i.TEXTURE_2D,0,0,0,At,kt,ct)}else e.texImage2D(i.TEXTURE_2D,0,zt,At,kt,ct);m(S)&&p(K),It.__version=tt.version,S.onUpdate&&S.onUpdate(S)}C.__version=S.version}function st(C,S,W){if(S.image.length!==6)return;const K=$t(C,S),nt=S.source;e.bindTexture(i.TEXTURE_CUBE_MAP,C.__webglTexture,i.TEXTURE0+W);const tt=n.get(nt);if(nt.version!==tt.__version||K===!0){e.activeTexture(i.TEXTURE0+W);const It=Qt.getPrimaries(Qt.workingColorSpace),mt=S.colorSpace===Zn?null:Qt.getPrimaries(S.colorSpace),wt=S.colorSpace===Zn||It===mt?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,S.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,S.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,S.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,wt);const Kt=S.isCompressedTexture||S.image[0].isCompressedTexture,ct=S.image[0]&&S.image[0].isDataTexture,At=[];for(let et=0;et<6;et++)!Kt&&!ct?At[et]=_(S.image[et],!0,s.maxCubemapSize):At[et]=ct?S.image[et].image:S.image[et],At[et]=Bt(S,At[et]);const kt=At[0],zt=r.convert(S.format,S.colorSpace),Ct=r.convert(S.type),Zt=M(S.internalFormat,zt,Ct,S.colorSpace),Yt=S.isVideoTexture!==!0,ce=tt.__version===void 0||K===!0,B=nt.dataReady;let gt=A(S,kt);Dt(i.TEXTURE_CUBE_MAP,S);let Z;if(Kt){Yt&&ce&&e.texStorage2D(i.TEXTURE_CUBE_MAP,gt,Zt,kt.width,kt.height);for(let et=0;et<6;et++){Z=At[et].mipmaps;for(let yt=0;yt<Z.length;yt++){const Mt=Z[yt];S.format!==mn?zt!==null?Yt?B&&e.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+et,yt,0,0,Mt.width,Mt.height,zt,Mt.data):e.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+et,yt,Zt,Mt.width,Mt.height,0,Mt.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):Yt?B&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+et,yt,0,0,Mt.width,Mt.height,zt,Ct,Mt.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+et,yt,Zt,Mt.width,Mt.height,0,zt,Ct,Mt.data)}}}else{if(Z=S.mipmaps,Yt&&ce){Z.length>0&&gt++;const et=dt(At[0]);e.texStorage2D(i.TEXTURE_CUBE_MAP,gt,Zt,et.width,et.height)}for(let et=0;et<6;et++)if(ct){Yt?B&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+et,0,0,0,At[et].width,At[et].height,zt,Ct,At[et].data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+et,0,Zt,At[et].width,At[et].height,0,zt,Ct,At[et].data);for(let yt=0;yt<Z.length;yt++){const Vt=Z[yt].image[et].image;Yt?B&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+et,yt+1,0,0,Vt.width,Vt.height,zt,Ct,Vt.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+et,yt+1,Zt,Vt.width,Vt.height,0,zt,Ct,Vt.data)}}else{Yt?B&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+et,0,0,0,zt,Ct,At[et]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+et,0,Zt,zt,Ct,At[et]);for(let yt=0;yt<Z.length;yt++){const Mt=Z[yt];Yt?B&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+et,yt+1,0,0,zt,Ct,Mt.image[et]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+et,yt+1,Zt,zt,Ct,Mt.image[et])}}}m(S)&&p(i.TEXTURE_CUBE_MAP),tt.__version=nt.version,S.onUpdate&&S.onUpdate(S)}C.__version=S.version}function ft(C,S,W,K,nt,tt){const It=r.convert(W.format,W.colorSpace),mt=r.convert(W.type),wt=M(W.internalFormat,It,mt,W.colorSpace),Kt=n.get(S),ct=n.get(W);if(ct.__renderTarget=S,!Kt.__hasExternalTextures){const At=Math.max(1,S.width>>tt),kt=Math.max(1,S.height>>tt);nt===i.TEXTURE_3D||nt===i.TEXTURE_2D_ARRAY?e.texImage3D(nt,tt,wt,At,kt,S.depth,0,It,mt,null):e.texImage2D(nt,tt,wt,At,kt,0,It,mt,null)}e.bindFramebuffer(i.FRAMEBUFFER,C),bt(S)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,K,nt,ct.__webglTexture,0,ot(S)):(nt===i.TEXTURE_2D||nt>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&nt<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,K,nt,ct.__webglTexture,tt),e.bindFramebuffer(i.FRAMEBUFFER,null)}function rt(C,S,W){if(i.bindRenderbuffer(i.RENDERBUFFER,C),S.depthBuffer){const K=S.depthTexture,nt=K&&K.isDepthTexture?K.type:null,tt=v(S.stencilBuffer,nt),It=S.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,mt=ot(S);bt(S)?a.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,mt,tt,S.width,S.height):W?i.renderbufferStorageMultisample(i.RENDERBUFFER,mt,tt,S.width,S.height):i.renderbufferStorage(i.RENDERBUFFER,tt,S.width,S.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,It,i.RENDERBUFFER,C)}else{const K=S.textures;for(let nt=0;nt<K.length;nt++){const tt=K[nt],It=r.convert(tt.format,tt.colorSpace),mt=r.convert(tt.type),wt=M(tt.internalFormat,It,mt,tt.colorSpace),Kt=ot(S);W&&bt(S)===!1?i.renderbufferStorageMultisample(i.RENDERBUFFER,Kt,wt,S.width,S.height):bt(S)?a.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,Kt,wt,S.width,S.height):i.renderbufferStorage(i.RENDERBUFFER,wt,S.width,S.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function Pt(C,S){if(S&&S.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(e.bindFramebuffer(i.FRAMEBUFFER,C),!(S.depthTexture&&S.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");const K=n.get(S.depthTexture);K.__renderTarget=S,(!K.__webglTexture||S.depthTexture.image.width!==S.width||S.depthTexture.image.height!==S.height)&&(S.depthTexture.image.width=S.width,S.depthTexture.image.height=S.height,S.depthTexture.needsUpdate=!0),V(S.depthTexture,0);const nt=K.__webglTexture,tt=ot(S);if(S.depthTexture.format===Ji)bt(S)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,nt,0,tt):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,nt,0);else if(S.depthTexture.format===os)bt(S)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,nt,0,tt):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,nt,0);else throw new Error("Unknown depthTexture format")}function Lt(C){const S=n.get(C),W=C.isWebGLCubeRenderTarget===!0;if(S.__boundDepthTexture!==C.depthTexture){const K=C.depthTexture;if(S.__depthDisposeCallback&&S.__depthDisposeCallback(),K){const nt=()=>{delete S.__boundDepthTexture,delete S.__depthDisposeCallback,K.removeEventListener("dispose",nt)};K.addEventListener("dispose",nt),S.__depthDisposeCallback=nt}S.__boundDepthTexture=K}if(C.depthTexture&&!S.__autoAllocateDepthBuffer){if(W)throw new Error("target.depthTexture not supported in Cube render targets");Pt(S.__webglFramebuffer,C)}else if(W){S.__webglDepthbuffer=[];for(let K=0;K<6;K++)if(e.bindFramebuffer(i.FRAMEBUFFER,S.__webglFramebuffer[K]),S.__webglDepthbuffer[K]===void 0)S.__webglDepthbuffer[K]=i.createRenderbuffer(),rt(S.__webglDepthbuffer[K],C,!1);else{const nt=C.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,tt=S.__webglDepthbuffer[K];i.bindRenderbuffer(i.RENDERBUFFER,tt),i.framebufferRenderbuffer(i.FRAMEBUFFER,nt,i.RENDERBUFFER,tt)}}else if(e.bindFramebuffer(i.FRAMEBUFFER,S.__webglFramebuffer),S.__webglDepthbuffer===void 0)S.__webglDepthbuffer=i.createRenderbuffer(),rt(S.__webglDepthbuffer,C,!1);else{const K=C.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,nt=S.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,nt),i.framebufferRenderbuffer(i.FRAMEBUFFER,K,i.RENDERBUFFER,nt)}e.bindFramebuffer(i.FRAMEBUFFER,null)}function _t(C,S,W){const K=n.get(C);S!==void 0&&ft(K.__webglFramebuffer,C,C.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),W!==void 0&&Lt(C)}function Et(C){const S=C.texture,W=n.get(C),K=n.get(S);C.addEventListener("dispose",R);const nt=C.textures,tt=C.isWebGLCubeRenderTarget===!0,It=nt.length>1;if(It||(K.__webglTexture===void 0&&(K.__webglTexture=i.createTexture()),K.__version=S.version,o.memory.textures++),tt){W.__webglFramebuffer=[];for(let mt=0;mt<6;mt++)if(S.mipmaps&&S.mipmaps.length>0){W.__webglFramebuffer[mt]=[];for(let wt=0;wt<S.mipmaps.length;wt++)W.__webglFramebuffer[mt][wt]=i.createFramebuffer()}else W.__webglFramebuffer[mt]=i.createFramebuffer()}else{if(S.mipmaps&&S.mipmaps.length>0){W.__webglFramebuffer=[];for(let mt=0;mt<S.mipmaps.length;mt++)W.__webglFramebuffer[mt]=i.createFramebuffer()}else W.__webglFramebuffer=i.createFramebuffer();if(It)for(let mt=0,wt=nt.length;mt<wt;mt++){const Kt=n.get(nt[mt]);Kt.__webglTexture===void 0&&(Kt.__webglTexture=i.createTexture(),o.memory.textures++)}if(C.samples>0&&bt(C)===!1){W.__webglMultisampledFramebuffer=i.createFramebuffer(),W.__webglColorRenderbuffer=[],e.bindFramebuffer(i.FRAMEBUFFER,W.__webglMultisampledFramebuffer);for(let mt=0;mt<nt.length;mt++){const wt=nt[mt];W.__webglColorRenderbuffer[mt]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,W.__webglColorRenderbuffer[mt]);const Kt=r.convert(wt.format,wt.colorSpace),ct=r.convert(wt.type),At=M(wt.internalFormat,Kt,ct,wt.colorSpace,C.isXRRenderTarget===!0),kt=ot(C);i.renderbufferStorageMultisample(i.RENDERBUFFER,kt,At,C.width,C.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+mt,i.RENDERBUFFER,W.__webglColorRenderbuffer[mt])}i.bindRenderbuffer(i.RENDERBUFFER,null),C.depthBuffer&&(W.__webglDepthRenderbuffer=i.createRenderbuffer(),rt(W.__webglDepthRenderbuffer,C,!0)),e.bindFramebuffer(i.FRAMEBUFFER,null)}}if(tt){e.bindTexture(i.TEXTURE_CUBE_MAP,K.__webglTexture),Dt(i.TEXTURE_CUBE_MAP,S);for(let mt=0;mt<6;mt++)if(S.mipmaps&&S.mipmaps.length>0)for(let wt=0;wt<S.mipmaps.length;wt++)ft(W.__webglFramebuffer[mt][wt],C,S,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+mt,wt);else ft(W.__webglFramebuffer[mt],C,S,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+mt,0);m(S)&&p(i.TEXTURE_CUBE_MAP),e.unbindTexture()}else if(It){for(let mt=0,wt=nt.length;mt<wt;mt++){const Kt=nt[mt],ct=n.get(Kt);e.bindTexture(i.TEXTURE_2D,ct.__webglTexture),Dt(i.TEXTURE_2D,Kt),ft(W.__webglFramebuffer,C,Kt,i.COLOR_ATTACHMENT0+mt,i.TEXTURE_2D,0),m(Kt)&&p(i.TEXTURE_2D)}e.unbindTexture()}else{let mt=i.TEXTURE_2D;if((C.isWebGL3DRenderTarget||C.isWebGLArrayRenderTarget)&&(mt=C.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),e.bindTexture(mt,K.__webglTexture),Dt(mt,S),S.mipmaps&&S.mipmaps.length>0)for(let wt=0;wt<S.mipmaps.length;wt++)ft(W.__webglFramebuffer[wt],C,S,i.COLOR_ATTACHMENT0,mt,wt);else ft(W.__webglFramebuffer,C,S,i.COLOR_ATTACHMENT0,mt,0);m(S)&&p(mt),e.unbindTexture()}C.depthBuffer&&Lt(C)}function $(C){const S=C.textures;for(let W=0,K=S.length;W<K;W++){const nt=S[W];if(m(nt)){const tt=x(C),It=n.get(nt).__webglTexture;e.bindTexture(tt,It),p(tt),e.unbindTexture()}}}const at=[],L=[];function Tt(C){if(C.samples>0){if(bt(C)===!1){const S=C.textures,W=C.width,K=C.height;let nt=i.COLOR_BUFFER_BIT;const tt=C.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,It=n.get(C),mt=S.length>1;if(mt)for(let wt=0;wt<S.length;wt++)e.bindFramebuffer(i.FRAMEBUFFER,It.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+wt,i.RENDERBUFFER,null),e.bindFramebuffer(i.FRAMEBUFFER,It.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+wt,i.TEXTURE_2D,null,0);e.bindFramebuffer(i.READ_FRAMEBUFFER,It.__webglMultisampledFramebuffer),e.bindFramebuffer(i.DRAW_FRAMEBUFFER,It.__webglFramebuffer);for(let wt=0;wt<S.length;wt++){if(C.resolveDepthBuffer&&(C.depthBuffer&&(nt|=i.DEPTH_BUFFER_BIT),C.stencilBuffer&&C.resolveStencilBuffer&&(nt|=i.STENCIL_BUFFER_BIT)),mt){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,It.__webglColorRenderbuffer[wt]);const Kt=n.get(S[wt]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,Kt,0)}i.blitFramebuffer(0,0,W,K,0,0,W,K,nt,i.NEAREST),l===!0&&(at.length=0,L.length=0,at.push(i.COLOR_ATTACHMENT0+wt),C.depthBuffer&&C.resolveDepthBuffer===!1&&(at.push(tt),L.push(tt),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,L)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,at))}if(e.bindFramebuffer(i.READ_FRAMEBUFFER,null),e.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),mt)for(let wt=0;wt<S.length;wt++){e.bindFramebuffer(i.FRAMEBUFFER,It.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+wt,i.RENDERBUFFER,It.__webglColorRenderbuffer[wt]);const Kt=n.get(S[wt]).__webglTexture;e.bindFramebuffer(i.FRAMEBUFFER,It.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+wt,i.TEXTURE_2D,Kt,0)}e.bindFramebuffer(i.DRAW_FRAMEBUFFER,It.__webglMultisampledFramebuffer)}else if(C.depthBuffer&&C.resolveDepthBuffer===!1&&l){const S=C.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[S])}}}function ot(C){return Math.min(s.maxSamples,C.samples)}function bt(C){const S=n.get(C);return C.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&S.__useRenderToTexture!==!1}function lt(C){const S=o.render.frame;h.get(C)!==S&&(h.set(C,S),C.update())}function Bt(C,S){const W=C.colorSpace,K=C.format,nt=C.type;return C.isCompressedTexture===!0||C.isVideoTexture===!0||W!==ii&&W!==Zn&&(Qt.getTransfer(W)===ae?(K!==mn||nt!==On)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",W)),S}function dt(C){return typeof HTMLImageElement<"u"&&C instanceof HTMLImageElement?(c.width=C.naturalWidth||C.width,c.height=C.naturalHeight||C.height):typeof VideoFrame<"u"&&C instanceof VideoFrame?(c.width=C.displayWidth,c.height=C.displayHeight):(c.width=C.width,c.height=C.height),c}this.allocateTextureUnit=U,this.resetTextureUnits=F,this.setTexture2D=V,this.setTexture2DArray=G,this.setTexture3D=D,this.setTextureCube=N,this.rebindTextures=_t,this.setupRenderTarget=Et,this.updateRenderTargetMipmap=$,this.updateMultisampleRenderTarget=Tt,this.setupDepthRenderbuffer=Lt,this.setupFrameBufferTexture=ft,this.useMultisampledRTT=bt}function vv(i,t){function e(n,s=Zn){let r;const o=Qt.getTransfer(s);if(n===On)return i.UNSIGNED_BYTE;if(n===El)return i.UNSIGNED_SHORT_4_4_4_4;if(n===Tl)return i.UNSIGNED_SHORT_5_5_5_1;if(n===ou)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===su)return i.BYTE;if(n===ru)return i.SHORT;if(n===Ys)return i.UNSIGNED_SHORT;if(n===wl)return i.INT;if(n===bi)return i.UNSIGNED_INT;if(n===xn)return i.FLOAT;if(n===er)return i.HALF_FLOAT;if(n===au)return i.ALPHA;if(n===lu)return i.RGB;if(n===mn)return i.RGBA;if(n===cu)return i.LUMINANCE;if(n===hu)return i.LUMINANCE_ALPHA;if(n===Ji)return i.DEPTH_COMPONENT;if(n===os)return i.DEPTH_STENCIL;if(n===Al)return i.RED;if(n===Cl)return i.RED_INTEGER;if(n===uu)return i.RG;if(n===Rl)return i.RG_INTEGER;if(n===Pl)return i.RGBA_INTEGER;if(n===Xr||n===$r||n===jr||n===Kr)if(o===ae)if(r=t.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===Xr)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===$r)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===jr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===Kr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=t.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===Xr)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===$r)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===jr)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===Kr)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===Ha||n===Va||n===Ga||n===Wa)if(r=t.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===Ha)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===Va)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===Ga)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===Wa)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===qa||n===Ya||n===Xa)if(r=t.get("WEBGL_compressed_texture_etc"),r!==null){if(n===qa||n===Ya)return o===ae?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===Xa)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(n===$a||n===ja||n===Ka||n===Za||n===Ja||n===Qa||n===tl||n===el||n===nl||n===il||n===sl||n===rl||n===ol||n===al)if(r=t.get("WEBGL_compressed_texture_astc"),r!==null){if(n===$a)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===ja)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===Ka)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===Za)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===Ja)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===Qa)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===tl)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===el)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===nl)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===il)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===sl)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===rl)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===ol)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===al)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===Zr||n===ll||n===cl)if(r=t.get("EXT_texture_compression_bptc"),r!==null){if(n===Zr)return o===ae?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===ll)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===cl)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===du||n===hl||n===ul||n===dl)if(r=t.get("EXT_texture_compression_rgtc"),r!==null){if(n===Zr)return r.COMPRESSED_RED_RGTC1_EXT;if(n===hl)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===ul)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===dl)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===rs?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:e}}class _v extends tn{constructor(t=[]){super(),this.isArrayCamera=!0,this.cameras=t}}class fe extends Pe{constructor(){super(),this.isGroup=!0,this.type="Group"}}const Mv={type:"move"};class ea{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new fe,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new fe,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new T,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new T),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new fe,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new T,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new T),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){const e=this._hand;if(e)for(const n of t.hand.values())this._getHandJoint(e,n)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,n){let s=null,r=null,o=null;const a=this._targetRay,l=this._grip,c=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(c&&t.hand){o=!0;for(const _ of t.hand.values()){const m=e.getJointPose(_,n),p=this._getHandJoint(c,_);m!==null&&(p.matrix.fromArray(m.transform.matrix),p.matrix.decompose(p.position,p.rotation,p.scale),p.matrixWorldNeedsUpdate=!0,p.jointRadius=m.radius),p.visible=m!==null}const h=c.joints["index-finger-tip"],u=c.joints["thumb-tip"],d=h.position.distanceTo(u.position),f=.02,g=.005;c.inputState.pinching&&d>f+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!c.inputState.pinching&&d<=f-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else l!==null&&t.gripSpace&&(r=e.getPose(t.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1));a!==null&&(s=e.getPose(t.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(a.matrix.fromArray(s.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,s.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(s.linearVelocity)):a.hasLinearVelocity=!1,s.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(s.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(Mv)))}return a!==null&&(a.visible=s!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=o!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){const n=new fe;n.matrixAutoUpdate=!1,n.visible=!1,t.joints[e.jointName]=n,t.add(n)}return t.joints[e.jointName]}}const xv=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,yv=`
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

}`;class bv{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,e,n){if(this.texture===null){const s=new Ve,r=t.properties.get(s);r.__webglTexture=e.texture,(e.depthNear!=n.depthNear||e.depthFar!=n.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=s}}getMesh(t){if(this.texture!==null&&this.mesh===null){const e=t.cameras[0].viewport,n=new nn({vertexShader:xv,fragmentShader:yv,uniforms:{depthColor:{value:this.texture},depthWidth:{value:e.z},depthHeight:{value:e.w}}});this.mesh=new J(new ze(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class Sv extends Ei{constructor(t,e){super();const n=this;let s=null,r=1,o=null,a="local-floor",l=1,c=null,h=null,u=null,d=null,f=null,g=null;const _=new bv,m=e.getContextAttributes();let p=null,x=null;const M=[],v=[],A=new H;let E=null;const R=new tn;R.viewport=new ie;const P=new tn;P.viewport=new ie;const b=[R,P],y=new _v;let I=null,F=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Q){let st=M[Q];return st===void 0&&(st=new ea,M[Q]=st),st.getTargetRaySpace()},this.getControllerGrip=function(Q){let st=M[Q];return st===void 0&&(st=new ea,M[Q]=st),st.getGripSpace()},this.getHand=function(Q){let st=M[Q];return st===void 0&&(st=new ea,M[Q]=st),st.getHandSpace()};function U(Q){const st=v.indexOf(Q.inputSource);if(st===-1)return;const ft=M[st];ft!==void 0&&(ft.update(Q.inputSource,Q.frame,c||o),ft.dispatchEvent({type:Q.type,data:Q.inputSource}))}function O(){s.removeEventListener("select",U),s.removeEventListener("selectstart",U),s.removeEventListener("selectend",U),s.removeEventListener("squeeze",U),s.removeEventListener("squeezestart",U),s.removeEventListener("squeezeend",U),s.removeEventListener("end",O),s.removeEventListener("inputsourceschange",V);for(let Q=0;Q<M.length;Q++){const st=v[Q];st!==null&&(v[Q]=null,M[Q].disconnect(st))}I=null,F=null,_.reset(),t.setRenderTarget(p),f=null,d=null,u=null,s=null,x=null,$t.stop(),n.isPresenting=!1,t.setPixelRatio(E),t.setSize(A.width,A.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Q){r=Q,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Q){a=Q,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||o},this.setReferenceSpace=function(Q){c=Q},this.getBaseLayer=function(){return d!==null?d:f},this.getBinding=function(){return u},this.getFrame=function(){return g},this.getSession=function(){return s},this.setSession=async function(Q){if(s=Q,s!==null){if(p=t.getRenderTarget(),s.addEventListener("select",U),s.addEventListener("selectstart",U),s.addEventListener("selectend",U),s.addEventListener("squeeze",U),s.addEventListener("squeezestart",U),s.addEventListener("squeezeend",U),s.addEventListener("end",O),s.addEventListener("inputsourceschange",V),m.xrCompatible!==!0&&await e.makeXRCompatible(),E=t.getPixelRatio(),t.getSize(A),s.renderState.layers===void 0){const st={antialias:m.antialias,alpha:!0,depth:m.depth,stencil:m.stencil,framebufferScaleFactor:r};f=new XRWebGLLayer(s,e,st),s.updateRenderState({baseLayer:f}),t.setPixelRatio(1),t.setSize(f.framebufferWidth,f.framebufferHeight,!1),x=new Si(f.framebufferWidth,f.framebufferHeight,{format:mn,type:On,colorSpace:t.outputColorSpace,stencilBuffer:m.stencil})}else{let st=null,ft=null,rt=null;m.depth&&(rt=m.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,st=m.stencil?os:Ji,ft=m.stencil?rs:bi);const Pt={colorFormat:e.RGBA8,depthFormat:rt,scaleFactor:r};u=new XRWebGLBinding(s,e),d=u.createProjectionLayer(Pt),s.updateRenderState({layers:[d]}),t.setPixelRatio(1),t.setSize(d.textureWidth,d.textureHeight,!1),x=new Si(d.textureWidth,d.textureHeight,{format:mn,type:On,depthTexture:new Tu(d.textureWidth,d.textureHeight,ft,void 0,void 0,void 0,void 0,void 0,void 0,st),stencilBuffer:m.stencil,colorSpace:t.outputColorSpace,samples:m.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1})}x.isXRRenderTarget=!0,this.setFoveation(l),c=null,o=await s.requestReferenceSpace(a),$t.setContext(s),$t.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return _.getDepthTexture()};function V(Q){for(let st=0;st<Q.removed.length;st++){const ft=Q.removed[st],rt=v.indexOf(ft);rt>=0&&(v[rt]=null,M[rt].disconnect(ft))}for(let st=0;st<Q.added.length;st++){const ft=Q.added[st];let rt=v.indexOf(ft);if(rt===-1){for(let Lt=0;Lt<M.length;Lt++)if(Lt>=v.length){v.push(ft),rt=Lt;break}else if(v[Lt]===null){v[Lt]=ft,rt=Lt;break}if(rt===-1)break}const Pt=M[rt];Pt&&Pt.connect(ft)}}const G=new T,D=new T;function N(Q,st,ft){G.setFromMatrixPosition(st.matrixWorld),D.setFromMatrixPosition(ft.matrixWorld);const rt=G.distanceTo(D),Pt=st.projectionMatrix.elements,Lt=ft.projectionMatrix.elements,_t=Pt[14]/(Pt[10]-1),Et=Pt[14]/(Pt[10]+1),$=(Pt[9]+1)/Pt[5],at=(Pt[9]-1)/Pt[5],L=(Pt[8]-1)/Pt[0],Tt=(Lt[8]+1)/Lt[0],ot=_t*L,bt=_t*Tt,lt=rt/(-L+Tt),Bt=lt*-L;if(st.matrixWorld.decompose(Q.position,Q.quaternion,Q.scale),Q.translateX(Bt),Q.translateZ(lt),Q.matrixWorld.compose(Q.position,Q.quaternion,Q.scale),Q.matrixWorldInverse.copy(Q.matrixWorld).invert(),Pt[10]===-1)Q.projectionMatrix.copy(st.projectionMatrix),Q.projectionMatrixInverse.copy(st.projectionMatrixInverse);else{const dt=_t+lt,C=Et+lt,S=ot-Bt,W=bt+(rt-Bt),K=$*Et/C*dt,nt=at*Et/C*dt;Q.projectionMatrix.makePerspective(S,W,K,nt,dt,C),Q.projectionMatrixInverse.copy(Q.projectionMatrix).invert()}}function j(Q,st){st===null?Q.matrixWorld.copy(Q.matrix):Q.matrixWorld.multiplyMatrices(st.matrixWorld,Q.matrix),Q.matrixWorldInverse.copy(Q.matrixWorld).invert()}this.updateCamera=function(Q){if(s===null)return;let st=Q.near,ft=Q.far;_.texture!==null&&(_.depthNear>0&&(st=_.depthNear),_.depthFar>0&&(ft=_.depthFar)),y.near=P.near=R.near=st,y.far=P.far=R.far=ft,(I!==y.near||F!==y.far)&&(s.updateRenderState({depthNear:y.near,depthFar:y.far}),I=y.near,F=y.far),R.layers.mask=Q.layers.mask|2,P.layers.mask=Q.layers.mask|4,y.layers.mask=R.layers.mask|P.layers.mask;const rt=Q.parent,Pt=y.cameras;j(y,rt);for(let Lt=0;Lt<Pt.length;Lt++)j(Pt[Lt],rt);Pt.length===2?N(y,R,P):y.projectionMatrix.copy(R.projectionMatrix),it(Q,y,rt)};function it(Q,st,ft){ft===null?Q.matrix.copy(st.matrixWorld):(Q.matrix.copy(ft.matrixWorld),Q.matrix.invert(),Q.matrix.multiply(st.matrixWorld)),Q.matrix.decompose(Q.position,Q.quaternion,Q.scale),Q.updateMatrixWorld(!0),Q.projectionMatrix.copy(st.projectionMatrix),Q.projectionMatrixInverse.copy(st.projectionMatrixInverse),Q.isPerspectiveCamera&&(Q.fov=Xs*2*Math.atan(1/Q.projectionMatrix.elements[5]),Q.zoom=1)}this.getCamera=function(){return y},this.getFoveation=function(){if(!(d===null&&f===null))return l},this.setFoveation=function(Q){l=Q,d!==null&&(d.fixedFoveation=Q),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=Q)},this.hasDepthSensing=function(){return _.texture!==null},this.getDepthSensingMesh=function(){return _.getMesh(y)};let ut=null;function Dt(Q,st){if(h=st.getViewerPose(c||o),g=st,h!==null){const ft=h.views;f!==null&&(t.setRenderTargetFramebuffer(x,f.framebuffer),t.setRenderTarget(x));let rt=!1;ft.length!==y.cameras.length&&(y.cameras.length=0,rt=!0);for(let Lt=0;Lt<ft.length;Lt++){const _t=ft[Lt];let Et=null;if(f!==null)Et=f.getViewport(_t);else{const at=u.getViewSubImage(d,_t);Et=at.viewport,Lt===0&&(t.setRenderTargetTextures(x,at.colorTexture,d.ignoreDepthValues?void 0:at.depthStencilTexture),t.setRenderTarget(x))}let $=b[Lt];$===void 0&&($=new tn,$.layers.enable(Lt),$.viewport=new ie,b[Lt]=$),$.matrix.fromArray(_t.transform.matrix),$.matrix.decompose($.position,$.quaternion,$.scale),$.projectionMatrix.fromArray(_t.projectionMatrix),$.projectionMatrixInverse.copy($.projectionMatrix).invert(),$.viewport.set(Et.x,Et.y,Et.width,Et.height),Lt===0&&(y.matrix.copy($.matrix),y.matrix.decompose(y.position,y.quaternion,y.scale)),rt===!0&&y.cameras.push($)}const Pt=s.enabledFeatures;if(Pt&&Pt.includes("depth-sensing")){const Lt=u.getDepthInformation(ft[0]);Lt&&Lt.isValid&&Lt.texture&&_.init(t,Lt,s.renderState)}}for(let ft=0;ft<M.length;ft++){const rt=v[ft],Pt=M[ft];rt!==null&&Pt!==void 0&&Pt.update(rt,st,c||o)}ut&&ut(Q,st),st.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:st}),g=null}const $t=new wu;$t.setAnimationLoop(Dt),this.setAnimationLoop=function(Q){ut=Q},this.dispose=function(){}}}const di=new ln,wv=new Jt;function Ev(i,t){function e(m,p){m.matrixAutoUpdate===!0&&m.updateMatrix(),p.value.copy(m.matrix)}function n(m,p){p.color.getRGB(m.fogColor.value,yu(i)),p.isFog?(m.fogNear.value=p.near,m.fogFar.value=p.far):p.isFogExp2&&(m.fogDensity.value=p.density)}function s(m,p,x,M,v){p.isMeshBasicMaterial||p.isMeshLambertMaterial?r(m,p):p.isMeshToonMaterial?(r(m,p),u(m,p)):p.isMeshPhongMaterial?(r(m,p),h(m,p)):p.isMeshStandardMaterial?(r(m,p),d(m,p),p.isMeshPhysicalMaterial&&f(m,p,v)):p.isMeshMatcapMaterial?(r(m,p),g(m,p)):p.isMeshDepthMaterial?r(m,p):p.isMeshDistanceMaterial?(r(m,p),_(m,p)):p.isMeshNormalMaterial?r(m,p):p.isLineBasicMaterial?(o(m,p),p.isLineDashedMaterial&&a(m,p)):p.isPointsMaterial?l(m,p,x,M):p.isSpriteMaterial?c(m,p):p.isShadowMaterial?(m.color.value.copy(p.color),m.opacity.value=p.opacity):p.isShaderMaterial&&(p.uniformsNeedUpdate=!1)}function r(m,p){m.opacity.value=p.opacity,p.color&&m.diffuse.value.copy(p.color),p.emissive&&m.emissive.value.copy(p.emissive).multiplyScalar(p.emissiveIntensity),p.map&&(m.map.value=p.map,e(p.map,m.mapTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,e(p.alphaMap,m.alphaMapTransform)),p.bumpMap&&(m.bumpMap.value=p.bumpMap,e(p.bumpMap,m.bumpMapTransform),m.bumpScale.value=p.bumpScale,p.side===Ye&&(m.bumpScale.value*=-1)),p.normalMap&&(m.normalMap.value=p.normalMap,e(p.normalMap,m.normalMapTransform),m.normalScale.value.copy(p.normalScale),p.side===Ye&&m.normalScale.value.negate()),p.displacementMap&&(m.displacementMap.value=p.displacementMap,e(p.displacementMap,m.displacementMapTransform),m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias),p.emissiveMap&&(m.emissiveMap.value=p.emissiveMap,e(p.emissiveMap,m.emissiveMapTransform)),p.specularMap&&(m.specularMap.value=p.specularMap,e(p.specularMap,m.specularMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest);const x=t.get(p),M=x.envMap,v=x.envMapRotation;M&&(m.envMap.value=M,di.copy(v),di.x*=-1,di.y*=-1,di.z*=-1,M.isCubeTexture&&M.isRenderTargetTexture===!1&&(di.y*=-1,di.z*=-1),m.envMapRotation.value.setFromMatrix4(wv.makeRotationFromEuler(di)),m.flipEnvMap.value=M.isCubeTexture&&M.isRenderTargetTexture===!1?-1:1,m.reflectivity.value=p.reflectivity,m.ior.value=p.ior,m.refractionRatio.value=p.refractionRatio),p.lightMap&&(m.lightMap.value=p.lightMap,m.lightMapIntensity.value=p.lightMapIntensity,e(p.lightMap,m.lightMapTransform)),p.aoMap&&(m.aoMap.value=p.aoMap,m.aoMapIntensity.value=p.aoMapIntensity,e(p.aoMap,m.aoMapTransform))}function o(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,p.map&&(m.map.value=p.map,e(p.map,m.mapTransform))}function a(m,p){m.dashSize.value=p.dashSize,m.totalSize.value=p.dashSize+p.gapSize,m.scale.value=p.scale}function l(m,p,x,M){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.size.value=p.size*x,m.scale.value=M*.5,p.map&&(m.map.value=p.map,e(p.map,m.uvTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,e(p.alphaMap,m.alphaMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest)}function c(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.rotation.value=p.rotation,p.map&&(m.map.value=p.map,e(p.map,m.mapTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,e(p.alphaMap,m.alphaMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest)}function h(m,p){m.specular.value.copy(p.specular),m.shininess.value=Math.max(p.shininess,1e-4)}function u(m,p){p.gradientMap&&(m.gradientMap.value=p.gradientMap)}function d(m,p){m.metalness.value=p.metalness,p.metalnessMap&&(m.metalnessMap.value=p.metalnessMap,e(p.metalnessMap,m.metalnessMapTransform)),m.roughness.value=p.roughness,p.roughnessMap&&(m.roughnessMap.value=p.roughnessMap,e(p.roughnessMap,m.roughnessMapTransform)),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)}function f(m,p,x){m.ior.value=p.ior,p.sheen>0&&(m.sheenColor.value.copy(p.sheenColor).multiplyScalar(p.sheen),m.sheenRoughness.value=p.sheenRoughness,p.sheenColorMap&&(m.sheenColorMap.value=p.sheenColorMap,e(p.sheenColorMap,m.sheenColorMapTransform)),p.sheenRoughnessMap&&(m.sheenRoughnessMap.value=p.sheenRoughnessMap,e(p.sheenRoughnessMap,m.sheenRoughnessMapTransform))),p.clearcoat>0&&(m.clearcoat.value=p.clearcoat,m.clearcoatRoughness.value=p.clearcoatRoughness,p.clearcoatMap&&(m.clearcoatMap.value=p.clearcoatMap,e(p.clearcoatMap,m.clearcoatMapTransform)),p.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=p.clearcoatRoughnessMap,e(p.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),p.clearcoatNormalMap&&(m.clearcoatNormalMap.value=p.clearcoatNormalMap,e(p.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(p.clearcoatNormalScale),p.side===Ye&&m.clearcoatNormalScale.value.negate())),p.dispersion>0&&(m.dispersion.value=p.dispersion),p.iridescence>0&&(m.iridescence.value=p.iridescence,m.iridescenceIOR.value=p.iridescenceIOR,m.iridescenceThicknessMinimum.value=p.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=p.iridescenceThicknessRange[1],p.iridescenceMap&&(m.iridescenceMap.value=p.iridescenceMap,e(p.iridescenceMap,m.iridescenceMapTransform)),p.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=p.iridescenceThicknessMap,e(p.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),p.transmission>0&&(m.transmission.value=p.transmission,m.transmissionSamplerMap.value=x.texture,m.transmissionSamplerSize.value.set(x.width,x.height),p.transmissionMap&&(m.transmissionMap.value=p.transmissionMap,e(p.transmissionMap,m.transmissionMapTransform)),m.thickness.value=p.thickness,p.thicknessMap&&(m.thicknessMap.value=p.thicknessMap,e(p.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=p.attenuationDistance,m.attenuationColor.value.copy(p.attenuationColor)),p.anisotropy>0&&(m.anisotropyVector.value.set(p.anisotropy*Math.cos(p.anisotropyRotation),p.anisotropy*Math.sin(p.anisotropyRotation)),p.anisotropyMap&&(m.anisotropyMap.value=p.anisotropyMap,e(p.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=p.specularIntensity,m.specularColor.value.copy(p.specularColor),p.specularColorMap&&(m.specularColorMap.value=p.specularColorMap,e(p.specularColorMap,m.specularColorMapTransform)),p.specularIntensityMap&&(m.specularIntensityMap.value=p.specularIntensityMap,e(p.specularIntensityMap,m.specularIntensityMapTransform))}function g(m,p){p.matcap&&(m.matcap.value=p.matcap)}function _(m,p){const x=t.get(p).light;m.referencePosition.value.setFromMatrixPosition(x.matrixWorld),m.nearDistance.value=x.shadow.camera.near,m.farDistance.value=x.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function Tv(i,t,e,n){let s={},r={},o=[];const a=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function l(x,M){const v=M.program;n.uniformBlockBinding(x,v)}function c(x,M){let v=s[x.id];v===void 0&&(g(x),v=h(x),s[x.id]=v,x.addEventListener("dispose",m));const A=M.program;n.updateUBOMapping(x,A);const E=t.render.frame;r[x.id]!==E&&(d(x),r[x.id]=E)}function h(x){const M=u();x.__bindingPointIndex=M;const v=i.createBuffer(),A=x.__size,E=x.usage;return i.bindBuffer(i.UNIFORM_BUFFER,v),i.bufferData(i.UNIFORM_BUFFER,A,E),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,M,v),v}function u(){for(let x=0;x<a;x++)if(o.indexOf(x)===-1)return o.push(x),x;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(x){const M=s[x.id],v=x.uniforms,A=x.__cache;i.bindBuffer(i.UNIFORM_BUFFER,M);for(let E=0,R=v.length;E<R;E++){const P=Array.isArray(v[E])?v[E]:[v[E]];for(let b=0,y=P.length;b<y;b++){const I=P[b];if(f(I,E,b,A)===!0){const F=I.__offset,U=Array.isArray(I.value)?I.value:[I.value];let O=0;for(let V=0;V<U.length;V++){const G=U[V],D=_(G);typeof G=="number"||typeof G=="boolean"?(I.__data[0]=G,i.bufferSubData(i.UNIFORM_BUFFER,F+O,I.__data)):G.isMatrix3?(I.__data[0]=G.elements[0],I.__data[1]=G.elements[1],I.__data[2]=G.elements[2],I.__data[3]=0,I.__data[4]=G.elements[3],I.__data[5]=G.elements[4],I.__data[6]=G.elements[5],I.__data[7]=0,I.__data[8]=G.elements[6],I.__data[9]=G.elements[7],I.__data[10]=G.elements[8],I.__data[11]=0):(G.toArray(I.__data,O),O+=D.storage/Float32Array.BYTES_PER_ELEMENT)}i.bufferSubData(i.UNIFORM_BUFFER,F,I.__data)}}}i.bindBuffer(i.UNIFORM_BUFFER,null)}function f(x,M,v,A){const E=x.value,R=M+"_"+v;if(A[R]===void 0)return typeof E=="number"||typeof E=="boolean"?A[R]=E:A[R]=E.clone(),!0;{const P=A[R];if(typeof E=="number"||typeof E=="boolean"){if(P!==E)return A[R]=E,!0}else if(P.equals(E)===!1)return P.copy(E),!0}return!1}function g(x){const M=x.uniforms;let v=0;const A=16;for(let R=0,P=M.length;R<P;R++){const b=Array.isArray(M[R])?M[R]:[M[R]];for(let y=0,I=b.length;y<I;y++){const F=b[y],U=Array.isArray(F.value)?F.value:[F.value];for(let O=0,V=U.length;O<V;O++){const G=U[O],D=_(G),N=v%A,j=N%D.boundary,it=N+j;v+=j,it!==0&&A-it<D.storage&&(v+=A-it),F.__data=new Float32Array(D.storage/Float32Array.BYTES_PER_ELEMENT),F.__offset=v,v+=D.storage}}}const E=v%A;return E>0&&(v+=A-E),x.__size=v,x.__cache={},this}function _(x){const M={boundary:0,storage:0};return typeof x=="number"||typeof x=="boolean"?(M.boundary=4,M.storage=4):x.isVector2?(M.boundary=8,M.storage=8):x.isVector3||x.isColor?(M.boundary=16,M.storage=12):x.isVector4?(M.boundary=16,M.storage=16):x.isMatrix3?(M.boundary=48,M.storage=48):x.isMatrix4?(M.boundary=64,M.storage=64):x.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",x),M}function m(x){const M=x.target;M.removeEventListener("dispose",m);const v=o.indexOf(M.__bindingPointIndex);o.splice(v,1),i.deleteBuffer(s[M.id]),delete s[M.id],delete r[M.id]}function p(){for(const x in s)i.deleteBuffer(s[x]);o=[],s={},r={}}return{bind:l,update:c,dispose:p}}class Av{constructor(t={}){const{canvas:e=mf(),context:n=null,depth:s=!0,stencil:r=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:u=!1,reverseDepthBuffer:d=!1}=t;this.isWebGLRenderer=!0;let f;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");f=n.getContextAttributes().alpha}else f=o;const g=new Uint32Array(4),_=new Int32Array(4);let m=null,p=null;const x=[],M=[];this.domElement=e,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=we,this.toneMapping=ei,this.toneMappingExposure=1;const v=this;let A=!1,E=0,R=0,P=null,b=-1,y=null;const I=new ie,F=new ie;let U=null;const O=new St(0);let V=0,G=e.width,D=e.height,N=1,j=null,it=null;const ut=new ie(0,0,G,D),Dt=new ie(0,0,G,D);let $t=!1;const Q=new Ul;let st=!1,ft=!1;const rt=new Jt,Pt=new Jt,Lt=new T,_t=new ie,Et={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let $=!1;function at(){return P===null?N:1}let L=n;function Tt(w,k){return e.getContext(w,k)}try{const w={alpha:!0,depth:s,stencil:r,antialias:a,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:u};if("setAttribute"in e&&e.setAttribute("data-engine",`three.js r${Sl}`),e.addEventListener("webglcontextlost",et,!1),e.addEventListener("webglcontextrestored",yt,!1),e.addEventListener("webglcontextcreationerror",Mt,!1),L===null){const k="webgl2";if(L=Tt(k,w),L===null)throw Tt(k)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(w){throw console.error("THREE.WebGLRenderer: "+w.message),w}let ot,bt,lt,Bt,dt,C,S,W,K,nt,tt,It,mt,wt,Kt,ct,At,kt,zt,Ct,Zt,Yt,ce,B;function gt(){ot=new I0(L),ot.init(),Yt=new vv(L,ot),bt=new T0(L,ot,t,Yt),lt=new pv(L,ot),bt.reverseDepthBuffer&&d&&lt.buffers.depth.setReversed(!0),Bt=new N0(L),dt=new Qg,C=new gv(L,ot,lt,dt,bt,Yt,Bt),S=new C0(v),W=new L0(v),K=new Vf(L),ce=new w0(L,K),nt=new D0(L,K,Bt,ce),tt=new F0(L,nt,K,Bt),zt=new O0(L,bt,C),ct=new A0(dt),It=new Jg(v,S,W,ot,bt,ce,ct),mt=new Ev(v,dt),wt=new ev,Kt=new av(ot),kt=new S0(v,S,W,lt,tt,f,l),At=new dv(v,tt,bt),B=new Tv(L,Bt,bt,lt),Ct=new E0(L,ot,Bt),Zt=new U0(L,ot,Bt),Bt.programs=It.programs,v.capabilities=bt,v.extensions=ot,v.properties=dt,v.renderLists=wt,v.shadowMap=At,v.state=lt,v.info=Bt}gt();const Z=new Sv(v,L);this.xr=Z,this.getContext=function(){return L},this.getContextAttributes=function(){return L.getContextAttributes()},this.forceContextLoss=function(){const w=ot.get("WEBGL_lose_context");w&&w.loseContext()},this.forceContextRestore=function(){const w=ot.get("WEBGL_lose_context");w&&w.restoreContext()},this.getPixelRatio=function(){return N},this.setPixelRatio=function(w){w!==void 0&&(N=w,this.setSize(G,D,!1))},this.getSize=function(w){return w.set(G,D)},this.setSize=function(w,k,Y=!0){if(Z.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}G=w,D=k,e.width=Math.floor(w*N),e.height=Math.floor(k*N),Y===!0&&(e.style.width=w+"px",e.style.height=k+"px"),this.setViewport(0,0,w,k)},this.getDrawingBufferSize=function(w){return w.set(G*N,D*N).floor()},this.setDrawingBufferSize=function(w,k,Y){G=w,D=k,N=Y,e.width=Math.floor(w*Y),e.height=Math.floor(k*Y),this.setViewport(0,0,w,k)},this.getCurrentViewport=function(w){return w.copy(I)},this.getViewport=function(w){return w.copy(ut)},this.setViewport=function(w,k,Y,X){w.isVector4?ut.set(w.x,w.y,w.z,w.w):ut.set(w,k,Y,X),lt.viewport(I.copy(ut).multiplyScalar(N).round())},this.getScissor=function(w){return w.copy(Dt)},this.setScissor=function(w,k,Y,X){w.isVector4?Dt.set(w.x,w.y,w.z,w.w):Dt.set(w,k,Y,X),lt.scissor(F.copy(Dt).multiplyScalar(N).round())},this.getScissorTest=function(){return $t},this.setScissorTest=function(w){lt.setScissorTest($t=w)},this.setOpaqueSort=function(w){j=w},this.setTransparentSort=function(w){it=w},this.getClearColor=function(w){return w.copy(kt.getClearColor())},this.setClearColor=function(){kt.setClearColor.apply(kt,arguments)},this.getClearAlpha=function(){return kt.getClearAlpha()},this.setClearAlpha=function(){kt.setClearAlpha.apply(kt,arguments)},this.clear=function(w=!0,k=!0,Y=!0){let X=0;if(w){let z=!1;if(P!==null){const ht=P.texture.format;z=ht===Pl||ht===Rl||ht===Cl}if(z){const ht=P.texture.type,xt=ht===On||ht===bi||ht===Ys||ht===rs||ht===El||ht===Tl,Ut=kt.getClearColor(),Nt=kt.getClearAlpha(),Ht=Ut.r,Gt=Ut.g,Ot=Ut.b;xt?(g[0]=Ht,g[1]=Gt,g[2]=Ot,g[3]=Nt,L.clearBufferuiv(L.COLOR,0,g)):(_[0]=Ht,_[1]=Gt,_[2]=Ot,_[3]=Nt,L.clearBufferiv(L.COLOR,0,_))}else X|=L.COLOR_BUFFER_BIT}k&&(X|=L.DEPTH_BUFFER_BIT),Y&&(X|=L.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),L.clear(X)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){e.removeEventListener("webglcontextlost",et,!1),e.removeEventListener("webglcontextrestored",yt,!1),e.removeEventListener("webglcontextcreationerror",Mt,!1),wt.dispose(),Kt.dispose(),dt.dispose(),S.dispose(),W.dispose(),tt.dispose(),ce.dispose(),B.dispose(),It.dispose(),Z.dispose(),Z.removeEventListener("sessionstart",ql),Z.removeEventListener("sessionend",Yl),oi.stop()};function et(w){w.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),A=!0}function yt(){console.log("THREE.WebGLRenderer: Context Restored."),A=!1;const w=Bt.autoReset,k=At.enabled,Y=At.autoUpdate,X=At.needsUpdate,z=At.type;gt(),Bt.autoReset=w,At.enabled=k,At.autoUpdate=Y,At.needsUpdate=X,At.type=z}function Mt(w){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",w.statusMessage)}function Vt(w){const k=w.target;k.removeEventListener("dispose",Vt),ge(k)}function ge(w){Fe(w),dt.remove(w)}function Fe(w){const k=dt.get(w).programs;k!==void 0&&(k.forEach(function(Y){It.releaseProgram(Y)}),w.isShaderMaterial&&It.releaseShaderCache(w))}this.renderBufferDirect=function(w,k,Y,X,z,ht){k===null&&(k=Et);const xt=z.isMesh&&z.matrixWorld.determinant()<0,Ut=pd(w,k,Y,X,z);lt.setMaterial(X,xt);let Nt=Y.index,Ht=1;if(X.wireframe===!0){if(Nt=nt.getWireframeAttribute(Y),Nt===void 0)return;Ht=2}const Gt=Y.drawRange,Ot=Y.attributes.position;let te=Gt.start*Ht,he=(Gt.start+Gt.count)*Ht;ht!==null&&(te=Math.max(te,ht.start*Ht),he=Math.min(he,(ht.start+ht.count)*Ht)),Nt!==null?(te=Math.max(te,0),he=Math.min(he,Nt.count)):Ot!=null&&(te=Math.max(te,0),he=Math.min(he,Ot.count));const ue=he-te;if(ue<0||ue===1/0)return;ce.setup(z,X,Ut,Y,Nt);let Xe,se=Ct;if(Nt!==null&&(Xe=K.get(Nt),se=Zt,se.setIndex(Xe)),z.isMesh)X.wireframe===!0?(lt.setLineWidth(X.wireframeLinewidth*at()),se.setMode(L.LINES)):se.setMode(L.TRIANGLES);else if(z.isLine){let Ft=X.linewidth;Ft===void 0&&(Ft=1),lt.setLineWidth(Ft*at()),z.isLineSegments?se.setMode(L.LINES):z.isLineLoop?se.setMode(L.LINE_LOOP):se.setMode(L.LINE_STRIP)}else z.isPoints?se.setMode(L.POINTS):z.isSprite&&se.setMode(L.TRIANGLES);if(z.isBatchedMesh)if(z._multiDrawInstances!==null)se.renderMultiDrawInstances(z._multiDrawStarts,z._multiDrawCounts,z._multiDrawCount,z._multiDrawInstances);else if(ot.get("WEBGL_multi_draw"))se.renderMultiDraw(z._multiDrawStarts,z._multiDrawCounts,z._multiDrawCount);else{const Ft=z._multiDrawStarts,Tn=z._multiDrawCounts,re=z._multiDrawCount,hn=Nt?K.get(Nt).bytesPerElement:1,Ri=dt.get(X).currentProgram.getUniforms();for(let Ke=0;Ke<re;Ke++)Ri.setValue(L,"_gl_DrawID",Ke),se.render(Ft[Ke]/hn,Tn[Ke])}else if(z.isInstancedMesh)se.renderInstances(te,ue,z.count);else if(Y.isInstancedBufferGeometry){const Ft=Y._maxInstanceCount!==void 0?Y._maxInstanceCount:1/0,Tn=Math.min(Y.instanceCount,Ft);se.renderInstances(te,ue,Tn)}else se.render(te,ue)};function oe(w,k,Y){w.transparent===!0&&w.side===je&&w.forceSinglePass===!1?(w.side=Ye,w.needsUpdate=!0,cr(w,k,Y),w.side=bn,w.needsUpdate=!0,cr(w,k,Y),w.side=je):cr(w,k,Y)}this.compile=function(w,k,Y=null){Y===null&&(Y=w),p=Kt.get(Y),p.init(k),M.push(p),Y.traverseVisible(function(z){z.isLight&&z.layers.test(k.layers)&&(p.pushLight(z),z.castShadow&&p.pushShadow(z))}),w!==Y&&w.traverseVisible(function(z){z.isLight&&z.layers.test(k.layers)&&(p.pushLight(z),z.castShadow&&p.pushShadow(z))}),p.setupLights();const X=new Set;return w.traverse(function(z){if(!(z.isMesh||z.isPoints||z.isLine||z.isSprite))return;const ht=z.material;if(ht)if(Array.isArray(ht))for(let xt=0;xt<ht.length;xt++){const Ut=ht[xt];oe(Ut,Y,z),X.add(Ut)}else oe(ht,Y,z),X.add(ht)}),M.pop(),p=null,X},this.compileAsync=function(w,k,Y=null){const X=this.compile(w,k,Y);return new Promise(z=>{function ht(){if(X.forEach(function(xt){dt.get(xt).currentProgram.isReady()&&X.delete(xt)}),X.size===0){z(w);return}setTimeout(ht,10)}ot.get("KHR_parallel_shader_compile")!==null?ht():setTimeout(ht,10)})};let cn=null;function En(w){cn&&cn(w)}function ql(){oi.stop()}function Yl(){oi.start()}const oi=new wu;oi.setAnimationLoop(En),typeof self<"u"&&oi.setContext(self),this.setAnimationLoop=function(w){cn=w,Z.setAnimationLoop(w),w===null?oi.stop():oi.start()},Z.addEventListener("sessionstart",ql),Z.addEventListener("sessionend",Yl),this.render=function(w,k){if(k!==void 0&&k.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(A===!0)return;if(w.matrixWorldAutoUpdate===!0&&w.updateMatrixWorld(),k.parent===null&&k.matrixWorldAutoUpdate===!0&&k.updateMatrixWorld(),Z.enabled===!0&&Z.isPresenting===!0&&(Z.cameraAutoUpdate===!0&&Z.updateCamera(k),k=Z.getCamera()),w.isScene===!0&&w.onBeforeRender(v,w,k,P),p=Kt.get(w,M.length),p.init(k),M.push(p),Pt.multiplyMatrices(k.projectionMatrix,k.matrixWorldInverse),Q.setFromProjectionMatrix(Pt),ft=this.localClippingEnabled,st=ct.init(this.clippingPlanes,ft),m=wt.get(w,x.length),m.init(),x.push(m),Z.enabled===!0&&Z.isPresenting===!0){const ht=v.xr.getDepthSensingMesh();ht!==null&&Ao(ht,k,-1/0,v.sortObjects)}Ao(w,k,0,v.sortObjects),m.finish(),v.sortObjects===!0&&m.sort(j,it),$=Z.enabled===!1||Z.isPresenting===!1||Z.hasDepthSensing()===!1,$&&kt.addToRenderList(m,w),this.info.render.frame++,st===!0&&ct.beginShadows();const Y=p.state.shadowsArray;At.render(Y,w,k),st===!0&&ct.endShadows(),this.info.autoReset===!0&&this.info.reset();const X=m.opaque,z=m.transmissive;if(p.setupLights(),k.isArrayCamera){const ht=k.cameras;if(z.length>0)for(let xt=0,Ut=ht.length;xt<Ut;xt++){const Nt=ht[xt];$l(X,z,w,Nt)}$&&kt.render(w);for(let xt=0,Ut=ht.length;xt<Ut;xt++){const Nt=ht[xt];Xl(m,w,Nt,Nt.viewport)}}else z.length>0&&$l(X,z,w,k),$&&kt.render(w),Xl(m,w,k);P!==null&&(C.updateMultisampleRenderTarget(P),C.updateRenderTargetMipmap(P)),w.isScene===!0&&w.onAfterRender(v,w,k),ce.resetDefaultState(),b=-1,y=null,M.pop(),M.length>0?(p=M[M.length-1],st===!0&&ct.setGlobalState(v.clippingPlanes,p.state.camera)):p=null,x.pop(),x.length>0?m=x[x.length-1]:m=null};function Ao(w,k,Y,X){if(w.visible===!1)return;if(w.layers.test(k.layers)){if(w.isGroup)Y=w.renderOrder;else if(w.isLOD)w.autoUpdate===!0&&w.update(k);else if(w.isLight)p.pushLight(w),w.castShadow&&p.pushShadow(w);else if(w.isSprite){if(!w.frustumCulled||Q.intersectsSprite(w)){X&&_t.setFromMatrixPosition(w.matrixWorld).applyMatrix4(Pt);const xt=tt.update(w),Ut=w.material;Ut.visible&&m.push(w,xt,Ut,Y,_t.z,null)}}else if((w.isMesh||w.isLine||w.isPoints)&&(!w.frustumCulled||Q.intersectsObject(w))){const xt=tt.update(w),Ut=w.material;if(X&&(w.boundingSphere!==void 0?(w.boundingSphere===null&&w.computeBoundingSphere(),_t.copy(w.boundingSphere.center)):(xt.boundingSphere===null&&xt.computeBoundingSphere(),_t.copy(xt.boundingSphere.center)),_t.applyMatrix4(w.matrixWorld).applyMatrix4(Pt)),Array.isArray(Ut)){const Nt=xt.groups;for(let Ht=0,Gt=Nt.length;Ht<Gt;Ht++){const Ot=Nt[Ht],te=Ut[Ot.materialIndex];te&&te.visible&&m.push(w,xt,te,Y,_t.z,Ot)}}else Ut.visible&&m.push(w,xt,Ut,Y,_t.z,null)}}const ht=w.children;for(let xt=0,Ut=ht.length;xt<Ut;xt++)Ao(ht[xt],k,Y,X)}function Xl(w,k,Y,X){const z=w.opaque,ht=w.transmissive,xt=w.transparent;p.setupLightsView(Y),st===!0&&ct.setGlobalState(v.clippingPlanes,Y),X&&lt.viewport(I.copy(X)),z.length>0&&lr(z,k,Y),ht.length>0&&lr(ht,k,Y),xt.length>0&&lr(xt,k,Y),lt.buffers.depth.setTest(!0),lt.buffers.depth.setMask(!0),lt.buffers.color.setMask(!0),lt.setPolygonOffset(!1)}function $l(w,k,Y,X){if((Y.isScene===!0?Y.overrideMaterial:null)!==null)return;p.state.transmissionRenderTarget[X.id]===void 0&&(p.state.transmissionRenderTarget[X.id]=new Si(1,1,{generateMipmaps:!0,type:ot.has("EXT_color_buffer_half_float")||ot.has("EXT_color_buffer_float")?er:On,minFilter:_i,samples:4,stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Qt.workingColorSpace}));const ht=p.state.transmissionRenderTarget[X.id],xt=X.viewport||I;ht.setSize(xt.z,xt.w);const Ut=v.getRenderTarget();v.setRenderTarget(ht),v.getClearColor(O),V=v.getClearAlpha(),V<1&&v.setClearColor(16777215,.5),v.clear(),$&&kt.render(Y);const Nt=v.toneMapping;v.toneMapping=ei;const Ht=X.viewport;if(X.viewport!==void 0&&(X.viewport=void 0),p.setupLightsView(X),st===!0&&ct.setGlobalState(v.clippingPlanes,X),lr(w,Y,X),C.updateMultisampleRenderTarget(ht),C.updateRenderTargetMipmap(ht),ot.has("WEBGL_multisampled_render_to_texture")===!1){let Gt=!1;for(let Ot=0,te=k.length;Ot<te;Ot++){const he=k[Ot],ue=he.object,Xe=he.geometry,se=he.material,Ft=he.group;if(se.side===je&&ue.layers.test(X.layers)){const Tn=se.side;se.side=Ye,se.needsUpdate=!0,jl(ue,Y,X,Xe,se,Ft),se.side=Tn,se.needsUpdate=!0,Gt=!0}}Gt===!0&&(C.updateMultisampleRenderTarget(ht),C.updateRenderTargetMipmap(ht))}v.setRenderTarget(Ut),v.setClearColor(O,V),Ht!==void 0&&(X.viewport=Ht),v.toneMapping=Nt}function lr(w,k,Y){const X=k.isScene===!0?k.overrideMaterial:null;for(let z=0,ht=w.length;z<ht;z++){const xt=w[z],Ut=xt.object,Nt=xt.geometry,Ht=X===null?xt.material:X,Gt=xt.group;Ut.layers.test(Y.layers)&&jl(Ut,k,Y,Nt,Ht,Gt)}}function jl(w,k,Y,X,z,ht){w.onBeforeRender(v,k,Y,X,z,ht),w.modelViewMatrix.multiplyMatrices(Y.matrixWorldInverse,w.matrixWorld),w.normalMatrix.getNormalMatrix(w.modelViewMatrix),z.onBeforeRender(v,k,Y,X,w,ht),z.transparent===!0&&z.side===je&&z.forceSinglePass===!1?(z.side=Ye,z.needsUpdate=!0,v.renderBufferDirect(Y,k,X,z,w,ht),z.side=bn,z.needsUpdate=!0,v.renderBufferDirect(Y,k,X,z,w,ht),z.side=je):v.renderBufferDirect(Y,k,X,z,w,ht),w.onAfterRender(v,k,Y,X,z,ht)}function cr(w,k,Y){k.isScene!==!0&&(k=Et);const X=dt.get(w),z=p.state.lights,ht=p.state.shadowsArray,xt=z.state.version,Ut=It.getParameters(w,z.state,ht,k,Y),Nt=It.getProgramCacheKey(Ut);let Ht=X.programs;X.environment=w.isMeshStandardMaterial?k.environment:null,X.fog=k.fog,X.envMap=(w.isMeshStandardMaterial?W:S).get(w.envMap||X.environment),X.envMapRotation=X.environment!==null&&w.envMap===null?k.environmentRotation:w.envMapRotation,Ht===void 0&&(w.addEventListener("dispose",Vt),Ht=new Map,X.programs=Ht);let Gt=Ht.get(Nt);if(Gt!==void 0){if(X.currentProgram===Gt&&X.lightsStateVersion===xt)return Zl(w,Ut),Gt}else Ut.uniforms=It.getUniforms(w),w.onBeforeCompile(Ut,v),Gt=It.acquireProgram(Ut,Nt),Ht.set(Nt,Gt),X.uniforms=Ut.uniforms;const Ot=X.uniforms;return(!w.isShaderMaterial&&!w.isRawShaderMaterial||w.clipping===!0)&&(Ot.clippingPlanes=ct.uniform),Zl(w,Ut),X.needsLights=gd(w),X.lightsStateVersion=xt,X.needsLights&&(Ot.ambientLightColor.value=z.state.ambient,Ot.lightProbe.value=z.state.probe,Ot.directionalLights.value=z.state.directional,Ot.directionalLightShadows.value=z.state.directionalShadow,Ot.spotLights.value=z.state.spot,Ot.spotLightShadows.value=z.state.spotShadow,Ot.rectAreaLights.value=z.state.rectArea,Ot.ltc_1.value=z.state.rectAreaLTC1,Ot.ltc_2.value=z.state.rectAreaLTC2,Ot.pointLights.value=z.state.point,Ot.pointLightShadows.value=z.state.pointShadow,Ot.hemisphereLights.value=z.state.hemi,Ot.directionalShadowMap.value=z.state.directionalShadowMap,Ot.directionalShadowMatrix.value=z.state.directionalShadowMatrix,Ot.spotShadowMap.value=z.state.spotShadowMap,Ot.spotLightMatrix.value=z.state.spotLightMatrix,Ot.spotLightMap.value=z.state.spotLightMap,Ot.pointShadowMap.value=z.state.pointShadowMap,Ot.pointShadowMatrix.value=z.state.pointShadowMatrix),X.currentProgram=Gt,X.uniformsList=null,Gt}function Kl(w){if(w.uniformsList===null){const k=w.currentProgram.getUniforms();w.uniformsList=Jr.seqWithValue(k.seq,w.uniforms)}return w.uniformsList}function Zl(w,k){const Y=dt.get(w);Y.outputColorSpace=k.outputColorSpace,Y.batching=k.batching,Y.batchingColor=k.batchingColor,Y.instancing=k.instancing,Y.instancingColor=k.instancingColor,Y.instancingMorph=k.instancingMorph,Y.skinning=k.skinning,Y.morphTargets=k.morphTargets,Y.morphNormals=k.morphNormals,Y.morphColors=k.morphColors,Y.morphTargetsCount=k.morphTargetsCount,Y.numClippingPlanes=k.numClippingPlanes,Y.numIntersection=k.numClipIntersection,Y.vertexAlphas=k.vertexAlphas,Y.vertexTangents=k.vertexTangents,Y.toneMapping=k.toneMapping}function pd(w,k,Y,X,z){k.isScene!==!0&&(k=Et),C.resetTextureUnits();const ht=k.fog,xt=X.isMeshStandardMaterial?k.environment:null,Ut=P===null?v.outputColorSpace:P.isXRRenderTarget===!0?P.texture.colorSpace:ii,Nt=(X.isMeshStandardMaterial?W:S).get(X.envMap||xt),Ht=X.vertexColors===!0&&!!Y.attributes.color&&Y.attributes.color.itemSize===4,Gt=!!Y.attributes.tangent&&(!!X.normalMap||X.anisotropy>0),Ot=!!Y.morphAttributes.position,te=!!Y.morphAttributes.normal,he=!!Y.morphAttributes.color;let ue=ei;X.toneMapped&&(P===null||P.isXRRenderTarget===!0)&&(ue=v.toneMapping);const Xe=Y.morphAttributes.position||Y.morphAttributes.normal||Y.morphAttributes.color,se=Xe!==void 0?Xe.length:0,Ft=dt.get(X),Tn=p.state.lights;if(st===!0&&(ft===!0||w!==y)){const rn=w===y&&X.id===b;ct.setState(X,w,rn)}let re=!1;X.version===Ft.__version?(Ft.needsLights&&Ft.lightsStateVersion!==Tn.state.version||Ft.outputColorSpace!==Ut||z.isBatchedMesh&&Ft.batching===!1||!z.isBatchedMesh&&Ft.batching===!0||z.isBatchedMesh&&Ft.batchingColor===!0&&z.colorTexture===null||z.isBatchedMesh&&Ft.batchingColor===!1&&z.colorTexture!==null||z.isInstancedMesh&&Ft.instancing===!1||!z.isInstancedMesh&&Ft.instancing===!0||z.isSkinnedMesh&&Ft.skinning===!1||!z.isSkinnedMesh&&Ft.skinning===!0||z.isInstancedMesh&&Ft.instancingColor===!0&&z.instanceColor===null||z.isInstancedMesh&&Ft.instancingColor===!1&&z.instanceColor!==null||z.isInstancedMesh&&Ft.instancingMorph===!0&&z.morphTexture===null||z.isInstancedMesh&&Ft.instancingMorph===!1&&z.morphTexture!==null||Ft.envMap!==Nt||X.fog===!0&&Ft.fog!==ht||Ft.numClippingPlanes!==void 0&&(Ft.numClippingPlanes!==ct.numPlanes||Ft.numIntersection!==ct.numIntersection)||Ft.vertexAlphas!==Ht||Ft.vertexTangents!==Gt||Ft.morphTargets!==Ot||Ft.morphNormals!==te||Ft.morphColors!==he||Ft.toneMapping!==ue||Ft.morphTargetsCount!==se)&&(re=!0):(re=!0,Ft.__version=X.version);let hn=Ft.currentProgram;re===!0&&(hn=cr(X,k,z));let Ri=!1,Ke=!1,fs=!1;const de=hn.getUniforms(),gn=Ft.uniforms;if(lt.useProgram(hn.program)&&(Ri=!0,Ke=!0,fs=!0),X.id!==b&&(b=X.id,Ke=!0),Ri||y!==w){lt.buffers.depth.getReversed()?(rt.copy(w.projectionMatrix),vf(rt),_f(rt),de.setValue(L,"projectionMatrix",rt)):de.setValue(L,"projectionMatrix",w.projectionMatrix),de.setValue(L,"viewMatrix",w.matrixWorldInverse);const Bn=de.map.cameraPosition;Bn!==void 0&&Bn.setValue(L,Lt.setFromMatrixPosition(w.matrixWorld)),bt.logarithmicDepthBuffer&&de.setValue(L,"logDepthBufFC",2/(Math.log(w.far+1)/Math.LN2)),(X.isMeshPhongMaterial||X.isMeshToonMaterial||X.isMeshLambertMaterial||X.isMeshBasicMaterial||X.isMeshStandardMaterial||X.isShaderMaterial)&&de.setValue(L,"isOrthographic",w.isOrthographicCamera===!0),y!==w&&(y=w,Ke=!0,fs=!0)}if(z.isSkinnedMesh){de.setOptional(L,z,"bindMatrix"),de.setOptional(L,z,"bindMatrixInverse");const rn=z.skeleton;rn&&(rn.boneTexture===null&&rn.computeBoneTexture(),de.setValue(L,"boneTexture",rn.boneTexture,C))}z.isBatchedMesh&&(de.setOptional(L,z,"batchingTexture"),de.setValue(L,"batchingTexture",z._matricesTexture,C),de.setOptional(L,z,"batchingIdTexture"),de.setValue(L,"batchingIdTexture",z._indirectTexture,C),de.setOptional(L,z,"batchingColorTexture"),z._colorsTexture!==null&&de.setValue(L,"batchingColorTexture",z._colorsTexture,C));const ps=Y.morphAttributes;if((ps.position!==void 0||ps.normal!==void 0||ps.color!==void 0)&&zt.update(z,Y,hn),(Ke||Ft.receiveShadow!==z.receiveShadow)&&(Ft.receiveShadow=z.receiveShadow,de.setValue(L,"receiveShadow",z.receiveShadow)),X.isMeshGouraudMaterial&&X.envMap!==null&&(gn.envMap.value=Nt,gn.flipEnvMap.value=Nt.isCubeTexture&&Nt.isRenderTargetTexture===!1?-1:1),X.isMeshStandardMaterial&&X.envMap===null&&k.environment!==null&&(gn.envMapIntensity.value=k.environmentIntensity),Ke&&(de.setValue(L,"toneMappingExposure",v.toneMappingExposure),Ft.needsLights&&md(gn,fs),ht&&X.fog===!0&&mt.refreshFogUniforms(gn,ht),mt.refreshMaterialUniforms(gn,X,N,D,p.state.transmissionRenderTarget[w.id]),Jr.upload(L,Kl(Ft),gn,C)),X.isShaderMaterial&&X.uniformsNeedUpdate===!0&&(Jr.upload(L,Kl(Ft),gn,C),X.uniformsNeedUpdate=!1),X.isSpriteMaterial&&de.setValue(L,"center",z.center),de.setValue(L,"modelViewMatrix",z.modelViewMatrix),de.setValue(L,"normalMatrix",z.normalMatrix),de.setValue(L,"modelMatrix",z.matrixWorld),X.isShaderMaterial||X.isRawShaderMaterial){const rn=X.uniformsGroups;for(let Bn=0,kn=rn.length;Bn<kn;Bn++){const Jl=rn[Bn];B.update(Jl,hn),B.bind(Jl,hn)}}return hn}function md(w,k){w.ambientLightColor.needsUpdate=k,w.lightProbe.needsUpdate=k,w.directionalLights.needsUpdate=k,w.directionalLightShadows.needsUpdate=k,w.pointLights.needsUpdate=k,w.pointLightShadows.needsUpdate=k,w.spotLights.needsUpdate=k,w.spotLightShadows.needsUpdate=k,w.rectAreaLights.needsUpdate=k,w.hemisphereLights.needsUpdate=k}function gd(w){return w.isMeshLambertMaterial||w.isMeshToonMaterial||w.isMeshPhongMaterial||w.isMeshStandardMaterial||w.isShadowMaterial||w.isShaderMaterial&&w.lights===!0}this.getActiveCubeFace=function(){return E},this.getActiveMipmapLevel=function(){return R},this.getRenderTarget=function(){return P},this.setRenderTargetTextures=function(w,k,Y){dt.get(w.texture).__webglTexture=k,dt.get(w.depthTexture).__webglTexture=Y;const X=dt.get(w);X.__hasExternalTextures=!0,X.__autoAllocateDepthBuffer=Y===void 0,X.__autoAllocateDepthBuffer||ot.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),X.__useRenderToTexture=!1)},this.setRenderTargetFramebuffer=function(w,k){const Y=dt.get(w);Y.__webglFramebuffer=k,Y.__useDefaultFramebuffer=k===void 0},this.setRenderTarget=function(w,k=0,Y=0){P=w,E=k,R=Y;let X=!0,z=null,ht=!1,xt=!1;if(w){const Nt=dt.get(w);if(Nt.__useDefaultFramebuffer!==void 0)lt.bindFramebuffer(L.FRAMEBUFFER,null),X=!1;else if(Nt.__webglFramebuffer===void 0)C.setupRenderTarget(w);else if(Nt.__hasExternalTextures)C.rebindTextures(w,dt.get(w.texture).__webglTexture,dt.get(w.depthTexture).__webglTexture);else if(w.depthBuffer){const Ot=w.depthTexture;if(Nt.__boundDepthTexture!==Ot){if(Ot!==null&&dt.has(Ot)&&(w.width!==Ot.image.width||w.height!==Ot.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");C.setupDepthRenderbuffer(w)}}const Ht=w.texture;(Ht.isData3DTexture||Ht.isDataArrayTexture||Ht.isCompressedArrayTexture)&&(xt=!0);const Gt=dt.get(w).__webglFramebuffer;w.isWebGLCubeRenderTarget?(Array.isArray(Gt[k])?z=Gt[k][Y]:z=Gt[k],ht=!0):w.samples>0&&C.useMultisampledRTT(w)===!1?z=dt.get(w).__webglMultisampledFramebuffer:Array.isArray(Gt)?z=Gt[Y]:z=Gt,I.copy(w.viewport),F.copy(w.scissor),U=w.scissorTest}else I.copy(ut).multiplyScalar(N).floor(),F.copy(Dt).multiplyScalar(N).floor(),U=$t;if(lt.bindFramebuffer(L.FRAMEBUFFER,z)&&X&&lt.drawBuffers(w,z),lt.viewport(I),lt.scissor(F),lt.setScissorTest(U),ht){const Nt=dt.get(w.texture);L.framebufferTexture2D(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_CUBE_MAP_POSITIVE_X+k,Nt.__webglTexture,Y)}else if(xt){const Nt=dt.get(w.texture),Ht=k||0;L.framebufferTextureLayer(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,Nt.__webglTexture,Y||0,Ht)}b=-1},this.readRenderTargetPixels=function(w,k,Y,X,z,ht,xt){if(!(w&&w.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Ut=dt.get(w).__webglFramebuffer;if(w.isWebGLCubeRenderTarget&&xt!==void 0&&(Ut=Ut[xt]),Ut){lt.bindFramebuffer(L.FRAMEBUFFER,Ut);try{const Nt=w.texture,Ht=Nt.format,Gt=Nt.type;if(!bt.textureFormatReadable(Ht)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!bt.textureTypeReadable(Gt)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}k>=0&&k<=w.width-X&&Y>=0&&Y<=w.height-z&&L.readPixels(k,Y,X,z,Yt.convert(Ht),Yt.convert(Gt),ht)}finally{const Nt=P!==null?dt.get(P).__webglFramebuffer:null;lt.bindFramebuffer(L.FRAMEBUFFER,Nt)}}},this.readRenderTargetPixelsAsync=async function(w,k,Y,X,z,ht,xt){if(!(w&&w.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Ut=dt.get(w).__webglFramebuffer;if(w.isWebGLCubeRenderTarget&&xt!==void 0&&(Ut=Ut[xt]),Ut){const Nt=w.texture,Ht=Nt.format,Gt=Nt.type;if(!bt.textureFormatReadable(Ht))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!bt.textureTypeReadable(Gt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");if(k>=0&&k<=w.width-X&&Y>=0&&Y<=w.height-z){lt.bindFramebuffer(L.FRAMEBUFFER,Ut);const Ot=L.createBuffer();L.bindBuffer(L.PIXEL_PACK_BUFFER,Ot),L.bufferData(L.PIXEL_PACK_BUFFER,ht.byteLength,L.STREAM_READ),L.readPixels(k,Y,X,z,Yt.convert(Ht),Yt.convert(Gt),0);const te=P!==null?dt.get(P).__webglFramebuffer:null;lt.bindFramebuffer(L.FRAMEBUFFER,te);const he=L.fenceSync(L.SYNC_GPU_COMMANDS_COMPLETE,0);return L.flush(),await gf(L,he,4),L.bindBuffer(L.PIXEL_PACK_BUFFER,Ot),L.getBufferSubData(L.PIXEL_PACK_BUFFER,0,ht),L.deleteBuffer(Ot),L.deleteSync(he),ht}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")}},this.copyFramebufferToTexture=function(w,k=null,Y=0){w.isTexture!==!0&&(Ts("WebGLRenderer: copyFramebufferToTexture function signature has changed."),k=arguments[0]||null,w=arguments[1]);const X=Math.pow(2,-Y),z=Math.floor(w.image.width*X),ht=Math.floor(w.image.height*X),xt=k!==null?k.x:0,Ut=k!==null?k.y:0;C.setTexture2D(w,0),L.copyTexSubImage2D(L.TEXTURE_2D,Y,0,0,xt,Ut,z,ht),lt.unbindTexture()},this.copyTextureToTexture=function(w,k,Y=null,X=null,z=0){w.isTexture!==!0&&(Ts("WebGLRenderer: copyTextureToTexture function signature has changed."),X=arguments[0]||null,w=arguments[1],k=arguments[2],z=arguments[3]||0,Y=null);let ht,xt,Ut,Nt,Ht,Gt,Ot,te,he;const ue=w.isCompressedTexture?w.mipmaps[z]:w.image;Y!==null?(ht=Y.max.x-Y.min.x,xt=Y.max.y-Y.min.y,Ut=Y.isBox3?Y.max.z-Y.min.z:1,Nt=Y.min.x,Ht=Y.min.y,Gt=Y.isBox3?Y.min.z:0):(ht=ue.width,xt=ue.height,Ut=ue.depth||1,Nt=0,Ht=0,Gt=0),X!==null?(Ot=X.x,te=X.y,he=X.z):(Ot=0,te=0,he=0);const Xe=Yt.convert(k.format),se=Yt.convert(k.type);let Ft;k.isData3DTexture?(C.setTexture3D(k,0),Ft=L.TEXTURE_3D):k.isDataArrayTexture||k.isCompressedArrayTexture?(C.setTexture2DArray(k,0),Ft=L.TEXTURE_2D_ARRAY):(C.setTexture2D(k,0),Ft=L.TEXTURE_2D),L.pixelStorei(L.UNPACK_FLIP_Y_WEBGL,k.flipY),L.pixelStorei(L.UNPACK_PREMULTIPLY_ALPHA_WEBGL,k.premultiplyAlpha),L.pixelStorei(L.UNPACK_ALIGNMENT,k.unpackAlignment);const Tn=L.getParameter(L.UNPACK_ROW_LENGTH),re=L.getParameter(L.UNPACK_IMAGE_HEIGHT),hn=L.getParameter(L.UNPACK_SKIP_PIXELS),Ri=L.getParameter(L.UNPACK_SKIP_ROWS),Ke=L.getParameter(L.UNPACK_SKIP_IMAGES);L.pixelStorei(L.UNPACK_ROW_LENGTH,ue.width),L.pixelStorei(L.UNPACK_IMAGE_HEIGHT,ue.height),L.pixelStorei(L.UNPACK_SKIP_PIXELS,Nt),L.pixelStorei(L.UNPACK_SKIP_ROWS,Ht),L.pixelStorei(L.UNPACK_SKIP_IMAGES,Gt);const fs=w.isDataArrayTexture||w.isData3DTexture,de=k.isDataArrayTexture||k.isData3DTexture;if(w.isRenderTargetTexture||w.isDepthTexture){const gn=dt.get(w),ps=dt.get(k),rn=dt.get(gn.__renderTarget),Bn=dt.get(ps.__renderTarget);lt.bindFramebuffer(L.READ_FRAMEBUFFER,rn.__webglFramebuffer),lt.bindFramebuffer(L.DRAW_FRAMEBUFFER,Bn.__webglFramebuffer);for(let kn=0;kn<Ut;kn++)fs&&L.framebufferTextureLayer(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,dt.get(w).__webglTexture,z,Gt+kn),w.isDepthTexture?(de&&L.framebufferTextureLayer(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,dt.get(k).__webglTexture,z,he+kn),L.blitFramebuffer(Nt,Ht,ht,xt,Ot,te,ht,xt,L.DEPTH_BUFFER_BIT,L.NEAREST)):de?L.copyTexSubImage3D(Ft,z,Ot,te,he+kn,Nt,Ht,ht,xt):L.copyTexSubImage2D(Ft,z,Ot,te,he+kn,Nt,Ht,ht,xt);lt.bindFramebuffer(L.READ_FRAMEBUFFER,null),lt.bindFramebuffer(L.DRAW_FRAMEBUFFER,null)}else de?w.isDataTexture||w.isData3DTexture?L.texSubImage3D(Ft,z,Ot,te,he,ht,xt,Ut,Xe,se,ue.data):k.isCompressedArrayTexture?L.compressedTexSubImage3D(Ft,z,Ot,te,he,ht,xt,Ut,Xe,ue.data):L.texSubImage3D(Ft,z,Ot,te,he,ht,xt,Ut,Xe,se,ue):w.isDataTexture?L.texSubImage2D(L.TEXTURE_2D,z,Ot,te,ht,xt,Xe,se,ue.data):w.isCompressedTexture?L.compressedTexSubImage2D(L.TEXTURE_2D,z,Ot,te,ue.width,ue.height,Xe,ue.data):L.texSubImage2D(L.TEXTURE_2D,z,Ot,te,ht,xt,Xe,se,ue);L.pixelStorei(L.UNPACK_ROW_LENGTH,Tn),L.pixelStorei(L.UNPACK_IMAGE_HEIGHT,re),L.pixelStorei(L.UNPACK_SKIP_PIXELS,hn),L.pixelStorei(L.UNPACK_SKIP_ROWS,Ri),L.pixelStorei(L.UNPACK_SKIP_IMAGES,Ke),z===0&&k.generateMipmaps&&L.generateMipmap(Ft),lt.unbindTexture()},this.copyTextureToTexture3D=function(w,k,Y=null,X=null,z=0){return w.isTexture!==!0&&(Ts("WebGLRenderer: copyTextureToTexture3D function signature has changed."),Y=arguments[0]||null,X=arguments[1]||null,w=arguments[2],k=arguments[3],z=arguments[4]||0),Ts('WebGLRenderer: copyTextureToTexture3D function has been deprecated. Use "copyTextureToTexture" instead.'),this.copyTextureToTexture(w,k,Y,X,z)},this.initRenderTarget=function(w){dt.get(w).__webglFramebuffer===void 0&&C.setupRenderTarget(w)},this.initTexture=function(w){w.isCubeTexture?C.setTextureCube(w,0):w.isData3DTexture?C.setTexture3D(w,0):w.isDataArrayTexture||w.isCompressedArrayTexture?C.setTexture2DArray(w,0):C.setTexture2D(w,0),lt.unbindTexture()},this.resetState=function(){E=0,R=0,P=null,lt.reset(),ce.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Un}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;const e=this.getContext();e.drawingBufferColorspace=Qt._getDrawingBufferColorSpace(t),e.unpackColorSpace=Qt._getUnpackColorSpace()}}class Lu extends Pe{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new ln,this.environmentIntensity=1,this.environmentRotation=new ln,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){const e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(e.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(e.object.backgroundIntensity=this.backgroundIntensity),e.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(e.object.environmentIntensity=this.environmentIntensity),e.object.environmentRotation=this.environmentRotation.toArray(),e}}class Cv extends Ve{constructor(t=null,e=1,n=1,s,r,o,a,l,c=en,h=en,u,d){super(null,o,a,l,c,h,s,r,u,d),this.isDataTexture=!0,this.image={data:t,width:e,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class Kc extends Re{constructor(t,e,n,s=1){super(t,e,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=s}copy(t){return super.copy(t),this.meshPerAttribute=t.meshPerAttribute,this}toJSON(){const t=super.toJSON();return t.meshPerAttribute=this.meshPerAttribute,t.isInstancedBufferAttribute=!0,t}}const Wi=new Jt,Zc=new Jt,Lr=[],Jc=new Ai,Rv=new Jt,Ms=new J,xs=new si;class Cs extends J{constructor(t,e,n){super(t,e),this.isInstancedMesh=!0,this.instanceMatrix=new Kc(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let s=0;s<n;s++)this.setMatrixAt(s,Rv)}computeBoundingBox(){const t=this.geometry,e=this.count;this.boundingBox===null&&(this.boundingBox=new Ai),t.boundingBox===null&&t.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,Wi),Jc.copy(t.boundingBox).applyMatrix4(Wi),this.boundingBox.union(Jc)}computeBoundingSphere(){const t=this.geometry,e=this.count;this.boundingSphere===null&&(this.boundingSphere=new si),t.boundingSphere===null&&t.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,Wi),xs.copy(t.boundingSphere).applyMatrix4(Wi),this.boundingSphere.union(xs)}copy(t,e){return super.copy(t,e),this.instanceMatrix.copy(t.instanceMatrix),t.morphTexture!==null&&(this.morphTexture=t.morphTexture.clone()),t.instanceColor!==null&&(this.instanceColor=t.instanceColor.clone()),this.count=t.count,t.boundingBox!==null&&(this.boundingBox=t.boundingBox.clone()),t.boundingSphere!==null&&(this.boundingSphere=t.boundingSphere.clone()),this}getColorAt(t,e){e.fromArray(this.instanceColor.array,t*3)}getMatrixAt(t,e){e.fromArray(this.instanceMatrix.array,t*16)}getMorphAt(t,e){const n=e.morphTargetInfluences,s=this.morphTexture.source.data.data,r=n.length+1,o=t*r+1;for(let a=0;a<n.length;a++)n[a]=s[o+a]}raycast(t,e){const n=this.matrixWorld,s=this.count;if(Ms.geometry=this.geometry,Ms.material=this.material,Ms.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),xs.copy(this.boundingSphere),xs.applyMatrix4(n),t.ray.intersectsSphere(xs)!==!1))for(let r=0;r<s;r++){this.getMatrixAt(r,Wi),Zc.multiplyMatrices(n,Wi),Ms.matrixWorld=Zc,Ms.raycast(t,Lr);for(let o=0,a=Lr.length;o<a;o++){const l=Lr[o];l.instanceId=r,l.object=this,e.push(l)}Lr.length=0}}setColorAt(t,e){this.instanceColor===null&&(this.instanceColor=new Kc(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),e.toArray(this.instanceColor.array,t*3)}setMatrixAt(t,e){e.toArray(this.instanceMatrix.array,t*16)}setMorphAt(t,e){const n=e.morphTargetInfluences,s=n.length+1;this.morphTexture===null&&(this.morphTexture=new Cv(new Float32Array(s*this.count),s,this.count,Al,xn));const r=this.morphTexture.source.data.data;let o=0;for(let c=0;c<n.length;c++)o+=n[c];const a=this.geometry.morphTargetsRelative?1:1-o,l=s*t;r[l]=a,r.set(n,l+1)}updateMorphTargets(){}dispose(){return this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null),this}}class Pv extends cs{static get type(){return"PointsMaterial"}constructor(t){super(),this.isPointsMaterial=!0,this.color=new St(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.size=t.size,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}}const Qc=new Jt,ml=new mo,Ir=new si,Dr=new T;class Lv extends Pe{constructor(t=new pe,e=new Pv){super(),this.isPoints=!0,this.type="Points",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}raycast(t,e){const n=this.geometry,s=this.matrixWorld,r=t.params.Points.threshold,o=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Ir.copy(n.boundingSphere),Ir.applyMatrix4(s),Ir.radius+=r,t.ray.intersectsSphere(Ir)===!1)return;Qc.copy(s).invert(),ml.copy(t.ray).applyMatrix4(Qc);const a=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=n.index,u=n.attributes.position;if(c!==null){const d=Math.max(0,o.start),f=Math.min(c.count,o.start+o.count);for(let g=d,_=f;g<_;g++){const m=c.getX(g);Dr.fromBufferAttribute(u,m),th(Dr,m,l,s,t,e,this)}}else{const d=Math.max(0,o.start),f=Math.min(u.count,o.start+o.count);for(let g=d,_=f;g<_;g++)Dr.fromBufferAttribute(u,g),th(Dr,g,l,s,t,e,this)}}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){const a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}}function th(i,t,e,n,s,r,o){const a=ml.distanceSqToPoint(i);if(a<e){const l=new T;ml.closestPointToPoint(i,l),l.applyMatrix4(n);const c=s.ray.origin.distanceTo(l);if(c<s.near||c>s.far)return;r.push({distance:c,distanceToRay:Math.sqrt(a),point:l,index:t,face:null,faceIndex:null,barycoord:null,object:o})}}class vo extends Ve{constructor(t,e,n,s,r,o,a,l,c){super(t,e,n,s,r,o,a,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}}class wn{constructor(){this.type="Curve",this.arcLengthDivisions=200}getPoint(){return console.warn("THREE.Curve: .getPoint() not implemented."),null}getPointAt(t,e){const n=this.getUtoTmapping(t);return this.getPoint(n,e)}getPoints(t=5){const e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return e}getSpacedPoints(t=5){const e=[];for(let n=0;n<=t;n++)e.push(this.getPointAt(n/t));return e}getLength(){const t=this.getLengths();return t[t.length-1]}getLengths(t=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===t+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;const e=[];let n,s=this.getPoint(0),r=0;e.push(0);for(let o=1;o<=t;o++)n=this.getPoint(o/t),r+=n.distanceTo(s),e.push(r),s=n;return this.cacheArcLengths=e,e}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(t,e){const n=this.getLengths();let s=0;const r=n.length;let o;e?o=e:o=t*n[r-1];let a=0,l=r-1,c;for(;a<=l;)if(s=Math.floor(a+(l-a)/2),c=n[s]-o,c<0)a=s+1;else if(c>0)l=s-1;else{l=s;break}if(s=l,n[s]===o)return s/(r-1);const h=n[s],d=n[s+1]-h,f=(o-h)/d;return(s+f)/(r-1)}getTangent(t,e){let s=t-1e-4,r=t+1e-4;s<0&&(s=0),r>1&&(r=1);const o=this.getPoint(s),a=this.getPoint(r),l=e||(o.isVector2?new H:new T);return l.copy(a).sub(o).normalize(),l}getTangentAt(t,e){const n=this.getUtoTmapping(t);return this.getTangent(n,e)}computeFrenetFrames(t,e){const n=new T,s=[],r=[],o=[],a=new T,l=new Jt;for(let f=0;f<=t;f++){const g=f/t;s[f]=this.getTangentAt(g,new T)}r[0]=new T,o[0]=new T;let c=Number.MAX_VALUE;const h=Math.abs(s[0].x),u=Math.abs(s[0].y),d=Math.abs(s[0].z);h<=c&&(c=h,n.set(1,0,0)),u<=c&&(c=u,n.set(0,1,0)),d<=c&&n.set(0,0,1),a.crossVectors(s[0],n).normalize(),r[0].crossVectors(s[0],a),o[0].crossVectors(s[0],r[0]);for(let f=1;f<=t;f++){if(r[f]=r[f-1].clone(),o[f]=o[f-1].clone(),a.crossVectors(s[f-1],s[f]),a.length()>Number.EPSILON){a.normalize();const g=Math.acos(be(s[f-1].dot(s[f]),-1,1));r[f].applyMatrix4(l.makeRotationAxis(a,g))}o[f].crossVectors(s[f],r[f])}if(e===!0){let f=Math.acos(be(r[0].dot(r[t]),-1,1));f/=t,s[0].dot(a.crossVectors(r[0],r[t]))>0&&(f=-f);for(let g=1;g<=t;g++)r[g].applyMatrix4(l.makeRotationAxis(s[g],f*g)),o[g].crossVectors(s[g],r[g])}return{tangents:s,normals:r,binormals:o}}clone(){return new this.constructor().copy(this)}copy(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}toJSON(){const t={metadata:{version:4.6,type:"Curve",generator:"Curve.toJSON"}};return t.arcLengthDivisions=this.arcLengthDivisions,t.type=this.type,t}fromJSON(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}}class Ol extends wn{constructor(t=0,e=0,n=1,s=1,r=0,o=Math.PI*2,a=!1,l=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=t,this.aY=e,this.xRadius=n,this.yRadius=s,this.aStartAngle=r,this.aEndAngle=o,this.aClockwise=a,this.aRotation=l}getPoint(t,e=new H){const n=e,s=Math.PI*2;let r=this.aEndAngle-this.aStartAngle;const o=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=s;for(;r>s;)r-=s;r<Number.EPSILON&&(o?r=0:r=s),this.aClockwise===!0&&!o&&(r===s?r=-s:r=r-s);const a=this.aStartAngle+t*r;let l=this.aX+this.xRadius*Math.cos(a),c=this.aY+this.yRadius*Math.sin(a);if(this.aRotation!==0){const h=Math.cos(this.aRotation),u=Math.sin(this.aRotation),d=l-this.aX,f=c-this.aY;l=d*h-f*u+this.aX,c=d*u+f*h+this.aY}return n.set(l,c)}copy(t){return super.copy(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}toJSON(){const t=super.toJSON();return t.aX=this.aX,t.aY=this.aY,t.xRadius=this.xRadius,t.yRadius=this.yRadius,t.aStartAngle=this.aStartAngle,t.aEndAngle=this.aEndAngle,t.aClockwise=this.aClockwise,t.aRotation=this.aRotation,t}fromJSON(t){return super.fromJSON(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}}class Iv extends Ol{constructor(t,e,n,s,r,o){super(t,e,n,n,s,r,o),this.isArcCurve=!0,this.type="ArcCurve"}}function Fl(){let i=0,t=0,e=0,n=0;function s(r,o,a,l){i=r,t=a,e=-3*r+3*o-2*a-l,n=2*r-2*o+a+l}return{initCatmullRom:function(r,o,a,l,c){s(o,a,c*(a-r),c*(l-o))},initNonuniformCatmullRom:function(r,o,a,l,c,h,u){let d=(o-r)/c-(a-r)/(c+h)+(a-o)/h,f=(a-o)/h-(l-o)/(h+u)+(l-a)/u;d*=h,f*=h,s(o,a,d,f)},calc:function(r){const o=r*r,a=o*r;return i+t*r+e*o+n*a}}}const Ur=new T,na=new Fl,ia=new Fl,sa=new Fl;class _o extends wn{constructor(t=[],e=!1,n="centripetal",s=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=t,this.closed=e,this.curveType=n,this.tension=s}getPoint(t,e=new T){const n=e,s=this.points,r=s.length,o=(r-(this.closed?0:1))*t;let a=Math.floor(o),l=o-a;this.closed?a+=a>0?0:(Math.floor(Math.abs(a)/r)+1)*r:l===0&&a===r-1&&(a=r-2,l=1);let c,h;this.closed||a>0?c=s[(a-1)%r]:(Ur.subVectors(s[0],s[1]).add(s[0]),c=Ur);const u=s[a%r],d=s[(a+1)%r];if(this.closed||a+2<r?h=s[(a+2)%r]:(Ur.subVectors(s[r-1],s[r-2]).add(s[r-1]),h=Ur),this.curveType==="centripetal"||this.curveType==="chordal"){const f=this.curveType==="chordal"?.5:.25;let g=Math.pow(c.distanceToSquared(u),f),_=Math.pow(u.distanceToSquared(d),f),m=Math.pow(d.distanceToSquared(h),f);_<1e-4&&(_=1),g<1e-4&&(g=_),m<1e-4&&(m=_),na.initNonuniformCatmullRom(c.x,u.x,d.x,h.x,g,_,m),ia.initNonuniformCatmullRom(c.y,u.y,d.y,h.y,g,_,m),sa.initNonuniformCatmullRom(c.z,u.z,d.z,h.z,g,_,m)}else this.curveType==="catmullrom"&&(na.initCatmullRom(c.x,u.x,d.x,h.x,this.tension),ia.initCatmullRom(c.y,u.y,d.y,h.y,this.tension),sa.initCatmullRom(c.z,u.z,d.z,h.z,this.tension));return n.set(na.calc(l),ia.calc(l),sa.calc(l)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const s=t.points[e];this.points.push(s.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){const t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){const s=this.points[e];t.points.push(s.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const s=t.points[e];this.points.push(new T().fromArray(s))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}}function eh(i,t,e,n,s){const r=(n-t)*.5,o=(s-e)*.5,a=i*i,l=i*a;return(2*e-2*n+r+o)*l+(-3*e+3*n-2*r-o)*a+r*i+e}function Dv(i,t){const e=1-i;return e*e*t}function Uv(i,t){return 2*(1-i)*i*t}function Nv(i,t){return i*i*t}function Ns(i,t,e,n){return Dv(i,t)+Uv(i,e)+Nv(i,n)}function Ov(i,t){const e=1-i;return e*e*e*t}function Fv(i,t){const e=1-i;return 3*e*e*i*t}function Bv(i,t){return 3*(1-i)*i*i*t}function kv(i,t){return i*i*i*t}function Os(i,t,e,n,s){return Ov(i,t)+Fv(i,e)+Bv(i,n)+kv(i,s)}class Iu extends wn{constructor(t=new H,e=new H,n=new H,s=new H){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=t,this.v1=e,this.v2=n,this.v3=s}getPoint(t,e=new H){const n=e,s=this.v0,r=this.v1,o=this.v2,a=this.v3;return n.set(Os(t,s.x,r.x,o.x,a.x),Os(t,s.y,r.y,o.y,a.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}}class zv extends wn{constructor(t=new T,e=new T,n=new T,s=new T){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=t,this.v1=e,this.v2=n,this.v3=s}getPoint(t,e=new T){const n=e,s=this.v0,r=this.v1,o=this.v2,a=this.v3;return n.set(Os(t,s.x,r.x,o.x,a.x),Os(t,s.y,r.y,o.y,a.y),Os(t,s.z,r.z,o.z,a.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}}class Du extends wn{constructor(t=new H,e=new H){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=t,this.v2=e}getPoint(t,e=new H){const n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new H){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class Hv extends wn{constructor(t=new T,e=new T){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=t,this.v2=e}getPoint(t,e=new T){const n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new T){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class Uu extends wn{constructor(t=new H,e=new H,n=new H){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new H){const n=e,s=this.v0,r=this.v1,o=this.v2;return n.set(Ns(t,s.x,r.x,o.x),Ns(t,s.y,r.y,o.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class Nu extends wn{constructor(t=new T,e=new T,n=new T){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new T){const n=e,s=this.v0,r=this.v1,o=this.v2;return n.set(Ns(t,s.x,r.x,o.x),Ns(t,s.y,r.y,o.y),Ns(t,s.z,r.z,o.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class Ou extends wn{constructor(t=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=t}getPoint(t,e=new H){const n=e,s=this.points,r=(s.length-1)*t,o=Math.floor(r),a=r-o,l=s[o===0?o:o-1],c=s[o],h=s[o>s.length-2?s.length-1:o+1],u=s[o>s.length-3?s.length-1:o+2];return n.set(eh(a,l.x,c.x,h.x,u.x),eh(a,l.y,c.y,h.y,u.y)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const s=t.points[e];this.points.push(s.clone())}return this}toJSON(){const t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){const s=this.points[e];t.points.push(s.toArray())}return t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const s=t.points[e];this.points.push(new H().fromArray(s))}return this}}var ro=Object.freeze({__proto__:null,ArcCurve:Iv,CatmullRomCurve3:_o,CubicBezierCurve:Iu,CubicBezierCurve3:zv,EllipseCurve:Ol,LineCurve:Du,LineCurve3:Hv,QuadraticBezierCurve:Uu,QuadraticBezierCurve3:Nu,SplineCurve:Ou});class Vv extends wn{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(t){this.curves.push(t)}closePath(){const t=this.curves[0].getPoint(0),e=this.curves[this.curves.length-1].getPoint(1);if(!t.equals(e)){const n=t.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new ro[n](e,t))}return this}getPoint(t,e){const n=t*this.getLength(),s=this.getCurveLengths();let r=0;for(;r<s.length;){if(s[r]>=n){const o=s[r]-n,a=this.curves[r],l=a.getLength(),c=l===0?0:1-o/l;return a.getPointAt(c,e)}r++}return null}getLength(){const t=this.getCurveLengths();return t[t.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;const t=[];let e=0;for(let n=0,s=this.curves.length;n<s;n++)e+=this.curves[n].getLength(),t.push(e);return this.cacheLengths=t,t}getSpacedPoints(t=40){const e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return this.autoClose&&e.push(e[0]),e}getPoints(t=12){const e=[];let n;for(let s=0,r=this.curves;s<r.length;s++){const o=r[s],a=o.isEllipseCurve?t*2:o.isLineCurve||o.isLineCurve3?1:o.isSplineCurve?t*o.points.length:t,l=o.getPoints(a);for(let c=0;c<l.length;c++){const h=l[c];n&&n.equals(h)||(e.push(h),n=h)}}return this.autoClose&&e.length>1&&!e[e.length-1].equals(e[0])&&e.push(e[0]),e}copy(t){super.copy(t),this.curves=[];for(let e=0,n=t.curves.length;e<n;e++){const s=t.curves[e];this.curves.push(s.clone())}return this.autoClose=t.autoClose,this}toJSON(){const t=super.toJSON();t.autoClose=this.autoClose,t.curves=[];for(let e=0,n=this.curves.length;e<n;e++){const s=this.curves[e];t.curves.push(s.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.autoClose=t.autoClose,this.curves=[];for(let e=0,n=t.curves.length;e<n;e++){const s=t.curves[e];this.curves.push(new ro[s.type]().fromJSON(s))}return this}}class oo extends Vv{constructor(t){super(),this.type="Path",this.currentPoint=new H,t&&this.setFromPoints(t)}setFromPoints(t){this.moveTo(t[0].x,t[0].y);for(let e=1,n=t.length;e<n;e++)this.lineTo(t[e].x,t[e].y);return this}moveTo(t,e){return this.currentPoint.set(t,e),this}lineTo(t,e){const n=new Du(this.currentPoint.clone(),new H(t,e));return this.curves.push(n),this.currentPoint.set(t,e),this}quadraticCurveTo(t,e,n,s){const r=new Uu(this.currentPoint.clone(),new H(t,e),new H(n,s));return this.curves.push(r),this.currentPoint.set(n,s),this}bezierCurveTo(t,e,n,s,r,o){const a=new Iu(this.currentPoint.clone(),new H(t,e),new H(n,s),new H(r,o));return this.curves.push(a),this.currentPoint.set(r,o),this}splineThru(t){const e=[this.currentPoint.clone()].concat(t),n=new Ou(e);return this.curves.push(n),this.currentPoint.copy(t[t.length-1]),this}arc(t,e,n,s,r,o){const a=this.currentPoint.x,l=this.currentPoint.y;return this.absarc(t+a,e+l,n,s,r,o),this}absarc(t,e,n,s,r,o){return this.absellipse(t,e,n,n,s,r,o),this}ellipse(t,e,n,s,r,o,a,l){const c=this.currentPoint.x,h=this.currentPoint.y;return this.absellipse(t+c,e+h,n,s,r,o,a,l),this}absellipse(t,e,n,s,r,o,a,l){const c=new Ol(t,e,n,s,r,o,a,l);if(this.curves.length>0){const u=c.getPoint(0);u.equals(this.currentPoint)||this.lineTo(u.x,u.y)}this.curves.push(c);const h=c.getPoint(1);return this.currentPoint.copy(h),this}copy(t){return super.copy(t),this.currentPoint.copy(t.currentPoint),this}toJSON(){const t=super.toJSON();return t.currentPoint=this.currentPoint.toArray(),t}fromJSON(t){return super.fromJSON(t),this.currentPoint.fromArray(t.currentPoint),this}}class Ue extends pe{constructor(t=[new H(0,-.5),new H(.5,0),new H(0,.5)],e=12,n=0,s=Math.PI*2){super(),this.type="LatheGeometry",this.parameters={points:t,segments:e,phiStart:n,phiLength:s},e=Math.floor(e),s=be(s,0,Math.PI*2);const r=[],o=[],a=[],l=[],c=[],h=1/e,u=new T,d=new H,f=new T,g=new T,_=new T;let m=0,p=0;for(let x=0;x<=t.length-1;x++)switch(x){case 0:m=t[x+1].x-t[x].x,p=t[x+1].y-t[x].y,f.x=p*1,f.y=-m,f.z=p*0,_.copy(f),f.normalize(),l.push(f.x,f.y,f.z);break;case t.length-1:l.push(_.x,_.y,_.z);break;default:m=t[x+1].x-t[x].x,p=t[x+1].y-t[x].y,f.x=p*1,f.y=-m,f.z=p*0,g.copy(f),f.x+=_.x,f.y+=_.y,f.z+=_.z,f.normalize(),l.push(f.x,f.y,f.z),_.copy(g)}for(let x=0;x<=e;x++){const M=n+x*h*s,v=Math.sin(M),A=Math.cos(M);for(let E=0;E<=t.length-1;E++){u.x=t[E].x*v,u.y=t[E].y,u.z=t[E].x*A,o.push(u.x,u.y,u.z),d.x=x/e,d.y=E/(t.length-1),a.push(d.x,d.y);const R=l[3*E+0]*v,P=l[3*E+1],b=l[3*E+0]*A;c.push(R,P,b)}}for(let x=0;x<e;x++)for(let M=0;M<t.length-1;M++){const v=M+x*t.length,A=v,E=v+t.length,R=v+t.length+1,P=v+1;r.push(A,E,P),r.push(R,P,E)}this.setIndex(r),this.setAttribute("position",new jt(o,3)),this.setAttribute("uv",new jt(a,2)),this.setAttribute("normal",new jt(c,3))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Ue(t.points,t.segments,t.phiStart,t.phiLength)}}class Mo extends Ue{constructor(t=1,e=1,n=4,s=8){const r=new oo;r.absarc(0,-e/2,t,Math.PI*1.5,0),r.absarc(0,e/2,t,0,Math.PI*.5),super(r.getPoints(n),s),this.type="CapsuleGeometry",this.parameters={radius:t,length:e,capSegments:n,radialSegments:s}}static fromJSON(t){return new Mo(t.radius,t.length,t.capSegments,t.radialSegments)}}class $s extends pe{constructor(t=1,e=32,n=0,s=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:t,segments:e,thetaStart:n,thetaLength:s},e=Math.max(3,e);const r=[],o=[],a=[],l=[],c=new T,h=new H;o.push(0,0,0),a.push(0,0,1),l.push(.5,.5);for(let u=0,d=3;u<=e;u++,d+=3){const f=n+u/e*s;c.x=t*Math.cos(f),c.y=t*Math.sin(f),o.push(c.x,c.y,c.z),a.push(0,0,1),h.x=(o[d]/t+1)/2,h.y=(o[d+1]/t+1)/2,l.push(h.x,h.y)}for(let u=1;u<=e;u++)r.push(u,u+1,0);this.setIndex(r),this.setAttribute("position",new jt(o,3)),this.setAttribute("normal",new jt(a,3)),this.setAttribute("uv",new jt(l,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new $s(t.radius,t.segments,t.thetaStart,t.thetaLength)}}class ne extends pe{constructor(t=1,e=1,n=1,s=32,r=1,o=!1,a=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:e,height:n,radialSegments:s,heightSegments:r,openEnded:o,thetaStart:a,thetaLength:l};const c=this;s=Math.floor(s),r=Math.floor(r);const h=[],u=[],d=[],f=[];let g=0;const _=[],m=n/2;let p=0;x(),o===!1&&(t>0&&M(!0),e>0&&M(!1)),this.setIndex(h),this.setAttribute("position",new jt(u,3)),this.setAttribute("normal",new jt(d,3)),this.setAttribute("uv",new jt(f,2));function x(){const v=new T,A=new T;let E=0;const R=(e-t)/n;for(let P=0;P<=r;P++){const b=[],y=P/r,I=y*(e-t)+t;for(let F=0;F<=s;F++){const U=F/s,O=U*l+a,V=Math.sin(O),G=Math.cos(O);A.x=I*V,A.y=-y*n+m,A.z=I*G,u.push(A.x,A.y,A.z),v.set(V,R,G).normalize(),d.push(v.x,v.y,v.z),f.push(U,1-y),b.push(g++)}_.push(b)}for(let P=0;P<s;P++)for(let b=0;b<r;b++){const y=_[b][P],I=_[b+1][P],F=_[b+1][P+1],U=_[b][P+1];(t>0||b!==0)&&(h.push(y,I,U),E+=3),(e>0||b!==r-1)&&(h.push(I,F,U),E+=3)}c.addGroup(p,E,0),p+=E}function M(v){const A=g,E=new H,R=new T;let P=0;const b=v===!0?t:e,y=v===!0?1:-1;for(let F=1;F<=s;F++)u.push(0,m*y,0),d.push(0,y,0),f.push(.5,.5),g++;const I=g;for(let F=0;F<=s;F++){const O=F/s*l+a,V=Math.cos(O),G=Math.sin(O);R.x=b*G,R.y=m*y,R.z=b*V,u.push(R.x,R.y,R.z),d.push(0,y,0),E.x=V*.5+.5,E.y=G*.5*y+.5,f.push(E.x,E.y),g++}for(let F=0;F<s;F++){const U=A+F,O=I+F;v===!0?h.push(O,O+1,U):h.push(O+1,O,U),P+=3}c.addGroup(p,P,v===!0?1:2),p+=P}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new ne(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class xo extends pe{constructor(t=[],e=[],n=1,s=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:t,indices:e,radius:n,detail:s};const r=[],o=[];a(s),c(n),h(),this.setAttribute("position",new jt(r,3)),this.setAttribute("normal",new jt(r.slice(),3)),this.setAttribute("uv",new jt(o,2)),s===0?this.computeVertexNormals():this.normalizeNormals();function a(x){const M=new T,v=new T,A=new T;for(let E=0;E<e.length;E+=3)f(e[E+0],M),f(e[E+1],v),f(e[E+2],A),l(M,v,A,x)}function l(x,M,v,A){const E=A+1,R=[];for(let P=0;P<=E;P++){R[P]=[];const b=x.clone().lerp(v,P/E),y=M.clone().lerp(v,P/E),I=E-P;for(let F=0;F<=I;F++)F===0&&P===E?R[P][F]=b:R[P][F]=b.clone().lerp(y,F/I)}for(let P=0;P<E;P++)for(let b=0;b<2*(E-P)-1;b++){const y=Math.floor(b/2);b%2===0?(d(R[P][y+1]),d(R[P+1][y]),d(R[P][y])):(d(R[P][y+1]),d(R[P+1][y+1]),d(R[P+1][y]))}}function c(x){const M=new T;for(let v=0;v<r.length;v+=3)M.x=r[v+0],M.y=r[v+1],M.z=r[v+2],M.normalize().multiplyScalar(x),r[v+0]=M.x,r[v+1]=M.y,r[v+2]=M.z}function h(){const x=new T;for(let M=0;M<r.length;M+=3){x.x=r[M+0],x.y=r[M+1],x.z=r[M+2];const v=m(x)/2/Math.PI+.5,A=p(x)/Math.PI+.5;o.push(v,1-A)}g(),u()}function u(){for(let x=0;x<o.length;x+=6){const M=o[x+0],v=o[x+2],A=o[x+4],E=Math.max(M,v,A),R=Math.min(M,v,A);E>.9&&R<.1&&(M<.2&&(o[x+0]+=1),v<.2&&(o[x+2]+=1),A<.2&&(o[x+4]+=1))}}function d(x){r.push(x.x,x.y,x.z)}function f(x,M){const v=x*3;M.x=t[v+0],M.y=t[v+1],M.z=t[v+2]}function g(){const x=new T,M=new T,v=new T,A=new T,E=new H,R=new H,P=new H;for(let b=0,y=0;b<r.length;b+=9,y+=6){x.set(r[b+0],r[b+1],r[b+2]),M.set(r[b+3],r[b+4],r[b+5]),v.set(r[b+6],r[b+7],r[b+8]),E.set(o[y+0],o[y+1]),R.set(o[y+2],o[y+3]),P.set(o[y+4],o[y+5]),A.copy(x).add(M).add(v).divideScalar(3);const I=m(A);_(E,y+0,x,I),_(R,y+2,M,I),_(P,y+4,v,I)}}function _(x,M,v,A){A<0&&x.x===1&&(o[M]=x.x-1),v.x===0&&v.z===0&&(o[M]=A/2/Math.PI+.5)}function m(x){return Math.atan2(x.z,-x.x)}function p(x){return Math.atan2(-x.y,Math.sqrt(x.x*x.x+x.z*x.z))}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new xo(t.vertices,t.indices,t.radius,t.details)}}class us extends oo{constructor(t){super(t),this.uuid=Ti(),this.type="Shape",this.holes=[]}getPointsHoles(t){const e=[];for(let n=0,s=this.holes.length;n<s;n++)e[n]=this.holes[n].getPoints(t);return e}extractPoints(t){return{shape:this.getPoints(t),holes:this.getPointsHoles(t)}}copy(t){super.copy(t),this.holes=[];for(let e=0,n=t.holes.length;e<n;e++){const s=t.holes[e];this.holes.push(s.clone())}return this}toJSON(){const t=super.toJSON();t.uuid=this.uuid,t.holes=[];for(let e=0,n=this.holes.length;e<n;e++){const s=this.holes[e];t.holes.push(s.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.uuid=t.uuid,this.holes=[];for(let e=0,n=t.holes.length;e<n;e++){const s=t.holes[e];this.holes.push(new oo().fromJSON(s))}return this}}const Gv={triangulate:function(i,t,e=2){const n=t&&t.length,s=n?t[0]*e:i.length;let r=Fu(i,0,s,e,!0);const o=[];if(!r||r.next===r.prev)return o;let a,l,c,h,u,d,f;if(n&&(r=$v(i,t,r,e)),i.length>80*e){a=c=i[0],l=h=i[1];for(let g=e;g<s;g+=e)u=i[g],d=i[g+1],u<a&&(a=u),d<l&&(l=d),u>c&&(c=u),d>h&&(h=d);f=Math.max(c-a,h-l),f=f!==0?32767/f:0}return js(r,o,e,a,l,f,0),o}};function Fu(i,t,e,n,s){let r,o;if(s===r_(i,t,e,n)>0)for(r=t;r<e;r+=n)o=nh(r,i[r],i[r+1],o);else for(r=e-n;r>=t;r-=n)o=nh(r,i[r],i[r+1],o);return o&&yo(o,o.next)&&(Zs(o),o=o.next),o}function wi(i,t){if(!i)return i;t||(t=i);let e=i,n;do if(n=!1,!e.steiner&&(yo(e,e.next)||me(e.prev,e,e.next)===0)){if(Zs(e),e=t=e.prev,e===e.next)break;n=!0}else e=e.next;while(n||e!==t);return t}function js(i,t,e,n,s,r,o){if(!i)return;!o&&r&&Qv(i,n,s,r);let a=i,l,c;for(;i.prev!==i.next;){if(l=i.prev,c=i.next,r?qv(i,n,s,r):Wv(i)){t.push(l.i/e|0),t.push(i.i/e|0),t.push(c.i/e|0),Zs(i),i=c.next,a=c.next;continue}if(i=c,i===a){o?o===1?(i=Yv(wi(i),t,e),js(i,t,e,n,s,r,2)):o===2&&Xv(i,t,e,n,s,r):js(wi(i),t,e,n,s,r,1);break}}}function Wv(i){const t=i.prev,e=i,n=i.next;if(me(t,e,n)>=0)return!1;const s=t.x,r=e.x,o=n.x,a=t.y,l=e.y,c=n.y,h=s<r?s<o?s:o:r<o?r:o,u=a<l?a<c?a:c:l<c?l:c,d=s>r?s>o?s:o:r>o?r:o,f=a>l?a>c?a:c:l>c?l:c;let g=n.next;for(;g!==t;){if(g.x>=h&&g.x<=d&&g.y>=u&&g.y<=f&&Ki(s,a,r,l,o,c,g.x,g.y)&&me(g.prev,g,g.next)>=0)return!1;g=g.next}return!0}function qv(i,t,e,n){const s=i.prev,r=i,o=i.next;if(me(s,r,o)>=0)return!1;const a=s.x,l=r.x,c=o.x,h=s.y,u=r.y,d=o.y,f=a<l?a<c?a:c:l<c?l:c,g=h<u?h<d?h:d:u<d?u:d,_=a>l?a>c?a:c:l>c?l:c,m=h>u?h>d?h:d:u>d?u:d,p=gl(f,g,t,e,n),x=gl(_,m,t,e,n);let M=i.prevZ,v=i.nextZ;for(;M&&M.z>=p&&v&&v.z<=x;){if(M.x>=f&&M.x<=_&&M.y>=g&&M.y<=m&&M!==s&&M!==o&&Ki(a,h,l,u,c,d,M.x,M.y)&&me(M.prev,M,M.next)>=0||(M=M.prevZ,v.x>=f&&v.x<=_&&v.y>=g&&v.y<=m&&v!==s&&v!==o&&Ki(a,h,l,u,c,d,v.x,v.y)&&me(v.prev,v,v.next)>=0))return!1;v=v.nextZ}for(;M&&M.z>=p;){if(M.x>=f&&M.x<=_&&M.y>=g&&M.y<=m&&M!==s&&M!==o&&Ki(a,h,l,u,c,d,M.x,M.y)&&me(M.prev,M,M.next)>=0)return!1;M=M.prevZ}for(;v&&v.z<=x;){if(v.x>=f&&v.x<=_&&v.y>=g&&v.y<=m&&v!==s&&v!==o&&Ki(a,h,l,u,c,d,v.x,v.y)&&me(v.prev,v,v.next)>=0)return!1;v=v.nextZ}return!0}function Yv(i,t,e){let n=i;do{const s=n.prev,r=n.next.next;!yo(s,r)&&Bu(s,n,n.next,r)&&Ks(s,r)&&Ks(r,s)&&(t.push(s.i/e|0),t.push(n.i/e|0),t.push(r.i/e|0),Zs(n),Zs(n.next),n=i=r),n=n.next}while(n!==i);return wi(n)}function Xv(i,t,e,n,s,r){let o=i;do{let a=o.next.next;for(;a!==o.prev;){if(o.i!==a.i&&n_(o,a)){let l=ku(o,a);o=wi(o,o.next),l=wi(l,l.next),js(o,t,e,n,s,r,0),js(l,t,e,n,s,r,0);return}a=a.next}o=o.next}while(o!==i)}function $v(i,t,e,n){const s=[];let r,o,a,l,c;for(r=0,o=t.length;r<o;r++)a=t[r]*n,l=r<o-1?t[r+1]*n:i.length,c=Fu(i,a,l,n,!1),c===c.next&&(c.steiner=!0),s.push(e_(c));for(s.sort(jv),r=0;r<s.length;r++)e=Kv(s[r],e);return e}function jv(i,t){return i.x-t.x}function Kv(i,t){const e=Zv(i,t);if(!e)return t;const n=ku(e,i);return wi(n,n.next),wi(e,e.next)}function Zv(i,t){let e=t,n=-1/0,s;const r=i.x,o=i.y;do{if(o<=e.y&&o>=e.next.y&&e.next.y!==e.y){const d=e.x+(o-e.y)*(e.next.x-e.x)/(e.next.y-e.y);if(d<=r&&d>n&&(n=d,s=e.x<e.next.x?e:e.next,d===r))return s}e=e.next}while(e!==t);if(!s)return null;const a=s,l=s.x,c=s.y;let h=1/0,u;e=s;do r>=e.x&&e.x>=l&&r!==e.x&&Ki(o<c?r:n,o,l,c,o<c?n:r,o,e.x,e.y)&&(u=Math.abs(o-e.y)/(r-e.x),Ks(e,i)&&(u<h||u===h&&(e.x>s.x||e.x===s.x&&Jv(s,e)))&&(s=e,h=u)),e=e.next;while(e!==a);return s}function Jv(i,t){return me(i.prev,i,t.prev)<0&&me(t.next,i,i.next)<0}function Qv(i,t,e,n){let s=i;do s.z===0&&(s.z=gl(s.x,s.y,t,e,n)),s.prevZ=s.prev,s.nextZ=s.next,s=s.next;while(s!==i);s.prevZ.nextZ=null,s.prevZ=null,t_(s)}function t_(i){let t,e,n,s,r,o,a,l,c=1;do{for(e=i,i=null,r=null,o=0;e;){for(o++,n=e,a=0,t=0;t<c&&(a++,n=n.nextZ,!!n);t++);for(l=c;a>0||l>0&&n;)a!==0&&(l===0||!n||e.z<=n.z)?(s=e,e=e.nextZ,a--):(s=n,n=n.nextZ,l--),r?r.nextZ=s:i=s,s.prevZ=r,r=s;e=n}r.nextZ=null,c*=2}while(o>1);return i}function gl(i,t,e,n,s){return i=(i-e)*s|0,t=(t-n)*s|0,i=(i|i<<8)&16711935,i=(i|i<<4)&252645135,i=(i|i<<2)&858993459,i=(i|i<<1)&1431655765,t=(t|t<<8)&16711935,t=(t|t<<4)&252645135,t=(t|t<<2)&858993459,t=(t|t<<1)&1431655765,i|t<<1}function e_(i){let t=i,e=i;do(t.x<e.x||t.x===e.x&&t.y<e.y)&&(e=t),t=t.next;while(t!==i);return e}function Ki(i,t,e,n,s,r,o,a){return(s-o)*(t-a)>=(i-o)*(r-a)&&(i-o)*(n-a)>=(e-o)*(t-a)&&(e-o)*(r-a)>=(s-o)*(n-a)}function n_(i,t){return i.next.i!==t.i&&i.prev.i!==t.i&&!i_(i,t)&&(Ks(i,t)&&Ks(t,i)&&s_(i,t)&&(me(i.prev,i,t.prev)||me(i,t.prev,t))||yo(i,t)&&me(i.prev,i,i.next)>0&&me(t.prev,t,t.next)>0)}function me(i,t,e){return(t.y-i.y)*(e.x-t.x)-(t.x-i.x)*(e.y-t.y)}function yo(i,t){return i.x===t.x&&i.y===t.y}function Bu(i,t,e,n){const s=Or(me(i,t,e)),r=Or(me(i,t,n)),o=Or(me(e,n,i)),a=Or(me(e,n,t));return!!(s!==r&&o!==a||s===0&&Nr(i,e,t)||r===0&&Nr(i,n,t)||o===0&&Nr(e,i,n)||a===0&&Nr(e,t,n))}function Nr(i,t,e){return t.x<=Math.max(i.x,e.x)&&t.x>=Math.min(i.x,e.x)&&t.y<=Math.max(i.y,e.y)&&t.y>=Math.min(i.y,e.y)}function Or(i){return i>0?1:i<0?-1:0}function i_(i,t){let e=i;do{if(e.i!==i.i&&e.next.i!==i.i&&e.i!==t.i&&e.next.i!==t.i&&Bu(e,e.next,i,t))return!0;e=e.next}while(e!==i);return!1}function Ks(i,t){return me(i.prev,i,i.next)<0?me(i,t,i.next)>=0&&me(i,i.prev,t)>=0:me(i,t,i.prev)<0||me(i,i.next,t)<0}function s_(i,t){let e=i,n=!1;const s=(i.x+t.x)/2,r=(i.y+t.y)/2;do e.y>r!=e.next.y>r&&e.next.y!==e.y&&s<(e.next.x-e.x)*(r-e.y)/(e.next.y-e.y)+e.x&&(n=!n),e=e.next;while(e!==i);return n}function ku(i,t){const e=new vl(i.i,i.x,i.y),n=new vl(t.i,t.x,t.y),s=i.next,r=t.prev;return i.next=t,t.prev=i,e.next=s,s.prev=e,n.next=e,e.prev=n,r.next=n,n.prev=r,n}function nh(i,t,e,n){const s=new vl(i,t,e);return n?(s.next=n.next,s.prev=n,n.next.prev=s,n.next=s):(s.prev=s,s.next=s),s}function Zs(i){i.next.prev=i.prev,i.prev.next=i.next,i.prevZ&&(i.prevZ.nextZ=i.nextZ),i.nextZ&&(i.nextZ.prevZ=i.prevZ)}function vl(i,t,e){this.i=i,this.x=t,this.y=e,this.prev=null,this.next=null,this.z=0,this.prevZ=null,this.nextZ=null,this.steiner=!1}function r_(i,t,e,n){let s=0;for(let r=t,o=e-n;r<e;r+=n)s+=(i[o]-i[r])*(i[r+1]+i[o+1]),o=r;return s}class Fs{static area(t){const e=t.length;let n=0;for(let s=e-1,r=0;r<e;s=r++)n+=t[s].x*t[r].y-t[r].x*t[s].y;return n*.5}static isClockWise(t){return Fs.area(t)<0}static triangulateShape(t,e){const n=[],s=[],r=[];ih(t),sh(n,t);let o=t.length;e.forEach(ih);for(let l=0;l<e.length;l++)s.push(o),o+=e[l].length,sh(n,e[l]);const a=Gv.triangulate(n,s);for(let l=0;l<a.length;l+=3)r.push(a.slice(l,l+3));return r}}function ih(i){const t=i.length;t>2&&i[t-1].equals(i[0])&&i.pop()}function sh(i,t){for(let e=0;e<t.length;e++)i.push(t[e].x),i.push(t[e].y)}class Ci extends pe{constructor(t=new us([new H(.5,.5),new H(-.5,.5),new H(-.5,-.5),new H(.5,-.5)]),e={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:t,options:e},t=Array.isArray(t)?t:[t];const n=this,s=[],r=[];for(let a=0,l=t.length;a<l;a++){const c=t[a];o(c)}this.setAttribute("position",new jt(s,3)),this.setAttribute("uv",new jt(r,2)),this.computeVertexNormals();function o(a){const l=[],c=e.curveSegments!==void 0?e.curveSegments:12,h=e.steps!==void 0?e.steps:1,u=e.depth!==void 0?e.depth:1;let d=e.bevelEnabled!==void 0?e.bevelEnabled:!0,f=e.bevelThickness!==void 0?e.bevelThickness:.2,g=e.bevelSize!==void 0?e.bevelSize:f-.1,_=e.bevelOffset!==void 0?e.bevelOffset:0,m=e.bevelSegments!==void 0?e.bevelSegments:3;const p=e.extrudePath,x=e.UVGenerator!==void 0?e.UVGenerator:o_;let M,v=!1,A,E,R,P;p&&(M=p.getSpacedPoints(h),v=!0,d=!1,A=p.computeFrenetFrames(h,!1),E=new T,R=new T,P=new T),d||(m=0,f=0,g=0,_=0);const b=a.extractPoints(c);let y=b.shape;const I=b.holes;if(!Fs.isClockWise(y)){y=y.reverse();for(let $=0,at=I.length;$<at;$++){const L=I[$];Fs.isClockWise(L)&&(I[$]=L.reverse())}}const U=Fs.triangulateShape(y,I),O=y;for(let $=0,at=I.length;$<at;$++){const L=I[$];y=y.concat(L)}function V($,at,L){return at||console.error("THREE.ExtrudeGeometry: vec does not exist"),$.clone().addScaledVector(at,L)}const G=y.length,D=U.length;function N($,at,L){let Tt,ot,bt;const lt=$.x-at.x,Bt=$.y-at.y,dt=L.x-$.x,C=L.y-$.y,S=lt*lt+Bt*Bt,W=lt*C-Bt*dt;if(Math.abs(W)>Number.EPSILON){const K=Math.sqrt(S),nt=Math.sqrt(dt*dt+C*C),tt=at.x-Bt/K,It=at.y+lt/K,mt=L.x-C/nt,wt=L.y+dt/nt,Kt=((mt-tt)*C-(wt-It)*dt)/(lt*C-Bt*dt);Tt=tt+lt*Kt-$.x,ot=It+Bt*Kt-$.y;const ct=Tt*Tt+ot*ot;if(ct<=2)return new H(Tt,ot);bt=Math.sqrt(ct/2)}else{let K=!1;lt>Number.EPSILON?dt>Number.EPSILON&&(K=!0):lt<-Number.EPSILON?dt<-Number.EPSILON&&(K=!0):Math.sign(Bt)===Math.sign(C)&&(K=!0),K?(Tt=-Bt,ot=lt,bt=Math.sqrt(S)):(Tt=lt,ot=Bt,bt=Math.sqrt(S/2))}return new H(Tt/bt,ot/bt)}const j=[];for(let $=0,at=O.length,L=at-1,Tt=$+1;$<at;$++,L++,Tt++)L===at&&(L=0),Tt===at&&(Tt=0),j[$]=N(O[$],O[L],O[Tt]);const it=[];let ut,Dt=j.concat();for(let $=0,at=I.length;$<at;$++){const L=I[$];ut=[];for(let Tt=0,ot=L.length,bt=ot-1,lt=Tt+1;Tt<ot;Tt++,bt++,lt++)bt===ot&&(bt=0),lt===ot&&(lt=0),ut[Tt]=N(L[Tt],L[bt],L[lt]);it.push(ut),Dt=Dt.concat(ut)}for(let $=0;$<m;$++){const at=$/m,L=f*Math.cos(at*Math.PI/2),Tt=g*Math.sin(at*Math.PI/2)+_;for(let ot=0,bt=O.length;ot<bt;ot++){const lt=V(O[ot],j[ot],Tt);rt(lt.x,lt.y,-L)}for(let ot=0,bt=I.length;ot<bt;ot++){const lt=I[ot];ut=it[ot];for(let Bt=0,dt=lt.length;Bt<dt;Bt++){const C=V(lt[Bt],ut[Bt],Tt);rt(C.x,C.y,-L)}}}const $t=g+_;for(let $=0;$<G;$++){const at=d?V(y[$],Dt[$],$t):y[$];v?(R.copy(A.normals[0]).multiplyScalar(at.x),E.copy(A.binormals[0]).multiplyScalar(at.y),P.copy(M[0]).add(R).add(E),rt(P.x,P.y,P.z)):rt(at.x,at.y,0)}for(let $=1;$<=h;$++)for(let at=0;at<G;at++){const L=d?V(y[at],Dt[at],$t):y[at];v?(R.copy(A.normals[$]).multiplyScalar(L.x),E.copy(A.binormals[$]).multiplyScalar(L.y),P.copy(M[$]).add(R).add(E),rt(P.x,P.y,P.z)):rt(L.x,L.y,u/h*$)}for(let $=m-1;$>=0;$--){const at=$/m,L=f*Math.cos(at*Math.PI/2),Tt=g*Math.sin(at*Math.PI/2)+_;for(let ot=0,bt=O.length;ot<bt;ot++){const lt=V(O[ot],j[ot],Tt);rt(lt.x,lt.y,u+L)}for(let ot=0,bt=I.length;ot<bt;ot++){const lt=I[ot];ut=it[ot];for(let Bt=0,dt=lt.length;Bt<dt;Bt++){const C=V(lt[Bt],ut[Bt],Tt);v?rt(C.x,C.y+M[h-1].y,M[h-1].x+L):rt(C.x,C.y,u+L)}}}Q(),st();function Q(){const $=s.length/3;if(d){let at=0,L=G*at;for(let Tt=0;Tt<D;Tt++){const ot=U[Tt];Pt(ot[2]+L,ot[1]+L,ot[0]+L)}at=h+m*2,L=G*at;for(let Tt=0;Tt<D;Tt++){const ot=U[Tt];Pt(ot[0]+L,ot[1]+L,ot[2]+L)}}else{for(let at=0;at<D;at++){const L=U[at];Pt(L[2],L[1],L[0])}for(let at=0;at<D;at++){const L=U[at];Pt(L[0]+G*h,L[1]+G*h,L[2]+G*h)}}n.addGroup($,s.length/3-$,0)}function st(){const $=s.length/3;let at=0;ft(O,at),at+=O.length;for(let L=0,Tt=I.length;L<Tt;L++){const ot=I[L];ft(ot,at),at+=ot.length}n.addGroup($,s.length/3-$,1)}function ft($,at){let L=$.length;for(;--L>=0;){const Tt=L;let ot=L-1;ot<0&&(ot=$.length-1);for(let bt=0,lt=h+m*2;bt<lt;bt++){const Bt=G*bt,dt=G*(bt+1),C=at+Tt+Bt,S=at+ot+Bt,W=at+ot+dt,K=at+Tt+dt;Lt(C,S,W,K)}}}function rt($,at,L){l.push($),l.push(at),l.push(L)}function Pt($,at,L){_t($),_t(at),_t(L);const Tt=s.length/3,ot=x.generateTopUV(n,s,Tt-3,Tt-2,Tt-1);Et(ot[0]),Et(ot[1]),Et(ot[2])}function Lt($,at,L,Tt){_t($),_t(at),_t(Tt),_t(at),_t(L),_t(Tt);const ot=s.length/3,bt=x.generateSideWallUV(n,s,ot-6,ot-3,ot-2,ot-1);Et(bt[0]),Et(bt[1]),Et(bt[3]),Et(bt[1]),Et(bt[2]),Et(bt[3])}function _t($){s.push(l[$*3+0]),s.push(l[$*3+1]),s.push(l[$*3+2])}function Et($){r.push($.x),r.push($.y)}}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){const t=super.toJSON(),e=this.parameters.shapes,n=this.parameters.options;return a_(e,n,t)}static fromJSON(t,e){const n=[];for(let r=0,o=t.shapes.length;r<o;r++){const a=e[t.shapes[r]];n.push(a)}const s=t.options.extrudePath;return s!==void 0&&(t.options.extrudePath=new ro[s.type]().fromJSON(s)),new Ci(n,t.options)}}const o_={generateTopUV:function(i,t,e,n,s){const r=t[e*3],o=t[e*3+1],a=t[n*3],l=t[n*3+1],c=t[s*3],h=t[s*3+1];return[new H(r,o),new H(a,l),new H(c,h)]},generateSideWallUV:function(i,t,e,n,s,r){const o=t[e*3],a=t[e*3+1],l=t[e*3+2],c=t[n*3],h=t[n*3+1],u=t[n*3+2],d=t[s*3],f=t[s*3+1],g=t[s*3+2],_=t[r*3],m=t[r*3+1],p=t[r*3+2];return Math.abs(a-h)<Math.abs(o-c)?[new H(o,1-l),new H(c,1-u),new H(d,1-g),new H(_,1-p)]:[new H(a,1-l),new H(h,1-u),new H(f,1-g),new H(m,1-p)]}};function a_(i,t,e){if(e.shapes=[],Array.isArray(i))for(let n=0,s=i.length;n<s;n++){const r=i[n];e.shapes.push(r.uuid)}else e.shapes.push(i.uuid);return e.options=Object.assign({},t),t.extrudePath!==void 0&&(e.options.extrudePath=t.extrudePath.toJSON()),e}class nr extends xo{constructor(t=1,e=0){const n=(1+Math.sqrt(5))/2,s=[-1,n,0,1,n,0,-1,-n,0,1,-n,0,0,-1,n,0,1,n,0,-1,-n,0,1,-n,n,0,-1,n,0,1,-n,0,-1,-n,0,1],r=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];super(s,r,t,e),this.type="IcosahedronGeometry",this.parameters={radius:t,detail:e}}static fromJSON(t){return new nr(t.radius,t.detail)}}class Bl extends xo{constructor(t=1,e=0){const n=[1,0,0,-1,0,0,0,1,0,0,-1,0,0,0,1,0,0,-1],s=[0,2,4,0,4,3,0,3,5,0,5,2,1,2,5,1,5,3,1,3,4,1,4,2];super(n,s,t,e),this.type="OctahedronGeometry",this.parameters={radius:t,detail:e}}static fromJSON(t){return new Bl(t.radius,t.detail)}}class ir extends pe{constructor(t=1,e=32,n=16,s=0,r=Math.PI*2,o=0,a=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:e,heightSegments:n,phiStart:s,phiLength:r,thetaStart:o,thetaLength:a},e=Math.max(3,Math.floor(e)),n=Math.max(2,Math.floor(n));const l=Math.min(o+a,Math.PI);let c=0;const h=[],u=new T,d=new T,f=[],g=[],_=[],m=[];for(let p=0;p<=n;p++){const x=[],M=p/n;let v=0;p===0&&o===0?v=.5/e:p===n&&l===Math.PI&&(v=-.5/e);for(let A=0;A<=e;A++){const E=A/e;u.x=-t*Math.cos(s+E*r)*Math.sin(o+M*a),u.y=t*Math.cos(o+M*a),u.z=t*Math.sin(s+E*r)*Math.sin(o+M*a),g.push(u.x,u.y,u.z),d.copy(u).normalize(),_.push(d.x,d.y,d.z),m.push(E+v,1-M),x.push(c++)}h.push(x)}for(let p=0;p<n;p++)for(let x=0;x<e;x++){const M=h[p][x+1],v=h[p][x],A=h[p+1][x],E=h[p+1][x+1];(p!==0||o>0)&&f.push(M,v,E),(p!==n-1||l<Math.PI)&&f.push(v,A,E)}this.setIndex(f),this.setAttribute("position",new jt(g,3)),this.setAttribute("normal",new jt(_,3)),this.setAttribute("uv",new jt(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new ir(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}}class bo extends pe{constructor(t=1,e=.4,n=12,s=48,r=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:t,tube:e,radialSegments:n,tubularSegments:s,arc:r},n=Math.floor(n),s=Math.floor(s);const o=[],a=[],l=[],c=[],h=new T,u=new T,d=new T;for(let f=0;f<=n;f++)for(let g=0;g<=s;g++){const _=g/s*r,m=f/n*Math.PI*2;u.x=(t+e*Math.cos(m))*Math.cos(_),u.y=(t+e*Math.cos(m))*Math.sin(_),u.z=e*Math.sin(m),a.push(u.x,u.y,u.z),h.x=t*Math.cos(_),h.y=t*Math.sin(_),d.subVectors(u,h).normalize(),l.push(d.x,d.y,d.z),c.push(g/s),c.push(f/n)}for(let f=1;f<=n;f++)for(let g=1;g<=s;g++){const _=(s+1)*f+g-1,m=(s+1)*(f-1)+g-1,p=(s+1)*(f-1)+g,x=(s+1)*f+g;o.push(_,m,x),o.push(m,p,x)}this.setIndex(o),this.setAttribute("position",new jt(a,3)),this.setAttribute("normal",new jt(l,3)),this.setAttribute("uv",new jt(c,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new bo(t.radius,t.tube,t.radialSegments,t.tubularSegments,t.arc)}}class sr extends pe{constructor(t=new Nu(new T(-1,-1,0),new T(-1,1,0),new T(1,1,0)),e=64,n=1,s=8,r=!1){super(),this.type="TubeGeometry",this.parameters={path:t,tubularSegments:e,radius:n,radialSegments:s,closed:r};const o=t.computeFrenetFrames(e,r);this.tangents=o.tangents,this.normals=o.normals,this.binormals=o.binormals;const a=new T,l=new T,c=new H;let h=new T;const u=[],d=[],f=[],g=[];_(),this.setIndex(g),this.setAttribute("position",new jt(u,3)),this.setAttribute("normal",new jt(d,3)),this.setAttribute("uv",new jt(f,2));function _(){for(let M=0;M<e;M++)m(M);m(r===!1?e:0),x(),p()}function m(M){h=t.getPointAt(M/e,h);const v=o.normals[M],A=o.binormals[M];for(let E=0;E<=s;E++){const R=E/s*Math.PI*2,P=Math.sin(R),b=-Math.cos(R);l.x=b*v.x+P*A.x,l.y=b*v.y+P*A.y,l.z=b*v.z+P*A.z,l.normalize(),d.push(l.x,l.y,l.z),a.x=h.x+n*l.x,a.y=h.y+n*l.y,a.z=h.z+n*l.z,u.push(a.x,a.y,a.z)}}function p(){for(let M=1;M<=e;M++)for(let v=1;v<=s;v++){const A=(s+1)*(M-1)+(v-1),E=(s+1)*M+(v-1),R=(s+1)*M+v,P=(s+1)*(M-1)+v;g.push(A,E,P),g.push(E,R,P)}}function x(){for(let M=0;M<=e;M++)for(let v=0;v<=s;v++)c.x=M/e,c.y=v/s,f.push(c.x,c.y)}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){const t=super.toJSON();return t.path=this.parameters.path.toJSON(),t}static fromJSON(t){return new sr(new ro[t.path.type]().fromJSON(t.path),t.tubularSegments,t.radius,t.radialSegments,t.closed)}}class vt extends cs{static get type(){return"MeshStandardMaterial"}constructor(t){super(),this.isMeshStandardMaterial=!0,this.defines={STANDARD:""},this.color=new St(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new St(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=fu,this.normalScale=new H(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new ln,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.defines={STANDARD:""},this.color.copy(t.color),this.roughness=t.roughness,this.metalness=t.metalness,this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.roughnessMap=t.roughnessMap,this.metalnessMap=t.metalnessMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.envMapIntensity=t.envMapIntensity,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}}class sn extends vt{static get type(){return"MeshPhysicalMaterial"}constructor(t){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new H(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return be(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(e){this.ior=(1+.4*e)/(1-.4*e)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new St(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new St(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new St(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(t)}get anisotropy(){return this._anisotropy}set anisotropy(t){this._anisotropy>0!=t>0&&this.version++,this._anisotropy=t}get clearcoat(){return this._clearcoat}set clearcoat(t){this._clearcoat>0!=t>0&&this.version++,this._clearcoat=t}get iridescence(){return this._iridescence}set iridescence(t){this._iridescence>0!=t>0&&this.version++,this._iridescence=t}get dispersion(){return this._dispersion}set dispersion(t){this._dispersion>0!=t>0&&this.version++,this._dispersion=t}get sheen(){return this._sheen}set sheen(t){this._sheen>0!=t>0&&this.version++,this._sheen=t}get transmission(){return this._transmission}set transmission(t){this._transmission>0!=t>0&&this.version++,this._transmission=t}copy(t){return super.copy(t),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=t.anisotropy,this.anisotropyRotation=t.anisotropyRotation,this.anisotropyMap=t.anisotropyMap,this.clearcoat=t.clearcoat,this.clearcoatMap=t.clearcoatMap,this.clearcoatRoughness=t.clearcoatRoughness,this.clearcoatRoughnessMap=t.clearcoatRoughnessMap,this.clearcoatNormalMap=t.clearcoatNormalMap,this.clearcoatNormalScale.copy(t.clearcoatNormalScale),this.dispersion=t.dispersion,this.ior=t.ior,this.iridescence=t.iridescence,this.iridescenceMap=t.iridescenceMap,this.iridescenceIOR=t.iridescenceIOR,this.iridescenceThicknessRange=[...t.iridescenceThicknessRange],this.iridescenceThicknessMap=t.iridescenceThicknessMap,this.sheen=t.sheen,this.sheenColor.copy(t.sheenColor),this.sheenColorMap=t.sheenColorMap,this.sheenRoughness=t.sheenRoughness,this.sheenRoughnessMap=t.sheenRoughnessMap,this.transmission=t.transmission,this.transmissionMap=t.transmissionMap,this.thickness=t.thickness,this.thicknessMap=t.thicknessMap,this.attenuationDistance=t.attenuationDistance,this.attenuationColor.copy(t.attenuationColor),this.specularIntensity=t.specularIntensity,this.specularIntensityMap=t.specularIntensityMap,this.specularColor.copy(t.specularColor),this.specularColorMap=t.specularColorMap,this}}class kl extends Pe{constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new St(t),this.intensity=e}dispose(){}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){const e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,this.groundColor!==void 0&&(e.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(e.object.distance=this.distance),this.angle!==void 0&&(e.object.angle=this.angle),this.decay!==void 0&&(e.object.decay=this.decay),this.penumbra!==void 0&&(e.object.penumbra=this.penumbra),this.shadow!==void 0&&(e.object.shadow=this.shadow.toJSON()),this.target!==void 0&&(e.object.target=this.target.uuid),e}}class l_ extends kl{constructor(t,e,n){super(t,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Pe.DEFAULT_UP),this.updateMatrix(),this.groundColor=new St(e)}copy(t,e){return super.copy(t,e),this.groundColor.copy(t.groundColor),this}}const ra=new Jt,rh=new T,oh=new T;class zu{constructor(t){this.camera=t,this.intensity=1,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new H(512,512),this.map=null,this.mapPass=null,this.matrix=new Jt,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Ul,this._frameExtents=new H(1,1),this._viewportCount=1,this._viewports=[new ie(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(t){const e=this.camera,n=this.matrix;rh.setFromMatrixPosition(t.matrixWorld),e.position.copy(rh),oh.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(oh),e.updateMatrixWorld(),ra.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),this._frustum.setFromProjectionMatrix(ra),n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(ra)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.intensity=t.intensity,this.bias=t.bias,this.radius=t.radius,this.mapSize.copy(t.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const t={};return this.intensity!==1&&(t.intensity=this.intensity),this.bias!==0&&(t.bias=this.bias),this.normalBias!==0&&(t.normalBias=this.normalBias),this.radius!==1&&(t.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(t.mapSize=this.mapSize.toArray()),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}}const ah=new Jt,ys=new T,oa=new T;class c_ extends zu{constructor(){super(new tn(90,1,.5,500)),this.isPointLightShadow=!0,this._frameExtents=new H(4,2),this._viewportCount=6,this._viewports=[new ie(2,1,1,1),new ie(0,1,1,1),new ie(3,1,1,1),new ie(1,1,1,1),new ie(3,0,1,1),new ie(1,0,1,1)],this._cubeDirections=[new T(1,0,0),new T(-1,0,0),new T(0,0,1),new T(0,0,-1),new T(0,1,0),new T(0,-1,0)],this._cubeUps=[new T(0,1,0),new T(0,1,0),new T(0,1,0),new T(0,1,0),new T(0,0,1),new T(0,0,-1)]}updateMatrices(t,e=0){const n=this.camera,s=this.matrix,r=t.distance||n.far;r!==n.far&&(n.far=r,n.updateProjectionMatrix()),ys.setFromMatrixPosition(t.matrixWorld),n.position.copy(ys),oa.copy(n.position),oa.add(this._cubeDirections[e]),n.up.copy(this._cubeUps[e]),n.lookAt(oa),n.updateMatrixWorld(),s.makeTranslation(-ys.x,-ys.y,-ys.z),ah.multiplyMatrices(n.projectionMatrix,n.matrixWorldInverse),this._frustum.setFromProjectionMatrix(ah)}}class Hu extends kl{constructor(t,e,n=0,s=2){super(t,e),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=s,this.shadow=new c_}get power(){return this.intensity*4*Math.PI}set power(t){this.intensity=t/(4*Math.PI)}dispose(){this.shadow.dispose()}copy(t,e){return super.copy(t,e),this.distance=t.distance,this.decay=t.decay,this.shadow=t.shadow.clone(),this}}class h_ extends zu{constructor(){super(new Eu(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class aa extends kl{constructor(t,e){super(t,e),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Pe.DEFAULT_UP),this.updateMatrix(),this.target=new Pe,this.shadow=new h_}dispose(){this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}}const lh=new Jt;class u_{constructor(t,e,n=0,s=1/0){this.ray=new mo(t,e),this.near=n,this.far=s,this.camera=null,this.layers=new Dl,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(t,e){this.ray.set(t,e)}setFromCamera(t,e){e.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(t.x,t.y,.5).unproject(e).sub(this.ray.origin).normalize(),this.camera=e):e.isOrthographicCamera?(this.ray.origin.set(t.x,t.y,(e.near+e.far)/(e.near-e.far)).unproject(e),this.ray.direction.set(0,0,-1).transformDirection(e.matrixWorld),this.camera=e):console.error("THREE.Raycaster: Unsupported camera type: "+e.type)}setFromXRController(t){return lh.identity().extractRotation(t.matrixWorld),this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(lh),this}intersectObject(t,e=!0,n=[]){return _l(t,this,n,e),n.sort(ch),n}intersectObjects(t,e=!0,n=[]){for(let s=0,r=t.length;s<r;s++)_l(t[s],this,n,e);return n.sort(ch),n}}function ch(i,t){return i.distance-t.distance}function _l(i,t,e,n){let s=!0;if(i.layers.test(t.layers)&&i.raycast(t,e)===!1&&(s=!1),s===!0&&n===!0){const r=i.children;for(let o=0,a=r.length;o<a;o++)_l(r[o],t,e,!0)}}class hh{constructor(t=1,e=0,n=0){return this.radius=t,this.phi=e,this.theta=n,this}set(t,e,n){return this.radius=t,this.phi=e,this.theta=n,this}copy(t){return this.radius=t.radius,this.phi=t.phi,this.theta=t.theta,this}makeSafe(){return this.phi=Math.max(1e-6,Math.min(Math.PI-1e-6,this.phi)),this}setFromVector3(t){return this.setFromCartesianCoords(t.x,t.y,t.z)}setFromCartesianCoords(t,e,n){return this.radius=Math.sqrt(t*t+e*e+n*n),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(t,n),this.phi=Math.acos(be(e/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}}class d_ extends Ei{constructor(t,e=null){super(),this.object=t,this.domElement=e,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(){}disconnect(){}dispose(){}update(){}}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Sl}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=Sl);const uh={type:"change"},zl={type:"start"},Vu={type:"end"},Fr=new mo,dh=new Kn,f_=Math.cos(70*Il.DEG2RAD),Se=new T,$e=2*Math.PI,le={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},la=1e-6;class p_ extends d_{constructor(t,e=null){super(t,e),this.state=le.NONE,this.enabled=!0,this.target=new T,this.cursor=new T,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:Zi.ROTATE,MIDDLE:Zi.DOLLY,RIGHT:Zi.PAN},this.touches={ONE:$i.ROTATE,TWO:$i.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._domElementKeyEvents=null,this._lastPosition=new T,this._lastQuaternion=new _e,this._lastTargetPosition=new T,this._quat=new _e().setFromUnitVectors(t.up,new T(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new hh,this._sphericalDelta=new hh,this._scale=1,this._panOffset=new T,this._rotateStart=new H,this._rotateEnd=new H,this._rotateDelta=new H,this._panStart=new H,this._panEnd=new H,this._panDelta=new H,this._dollyStart=new H,this._dollyEnd=new H,this._dollyDelta=new H,this._dollyDirection=new T,this._mouse=new H,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=g_.bind(this),this._onPointerDown=m_.bind(this),this._onPointerUp=v_.bind(this),this._onContextMenu=w_.bind(this),this._onMouseWheel=x_.bind(this),this._onKeyDown=y_.bind(this),this._onTouchStart=b_.bind(this),this._onTouchMove=S_.bind(this),this._onMouseDown=__.bind(this),this._onMouseMove=M_.bind(this),this._interceptControlDown=E_.bind(this),this._interceptControlUp=T_.bind(this),this.domElement!==null&&this.connect(),this.update()}connect(){this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents(),this.domElement.getRootNode().removeEventListener("keydown",this._interceptControlDown,{capture:!0}),this.domElement.style.touchAction="auto"}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(t){t.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=t}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(uh),this.update(),this.state=le.NONE}update(t=null){const e=this.object.position;Se.copy(e).sub(this.target),Se.applyQuaternion(this._quat),this._spherical.setFromVector3(Se),this.autoRotate&&this.state===le.NONE&&this._rotateLeft(this._getAutoRotationAngle(t)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let n=this.minAzimuthAngle,s=this.maxAzimuthAngle;isFinite(n)&&isFinite(s)&&(n<-Math.PI?n+=$e:n>Math.PI&&(n-=$e),s<-Math.PI?s+=$e:s>Math.PI&&(s-=$e),n<=s?this._spherical.theta=Math.max(n,Math.min(s,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(n+s)/2?Math.max(n,this._spherical.theta):Math.min(s,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let r=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{const o=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),r=o!=this._spherical.radius}if(Se.setFromSpherical(this._spherical),Se.applyQuaternion(this._quatInverse),e.copy(this.target).add(Se),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let o=null;if(this.object.isPerspectiveCamera){const a=Se.length();o=this._clampDistance(a*this._scale);const l=a-o;this.object.position.addScaledVector(this._dollyDirection,l),this.object.updateMatrixWorld(),r=!!l}else if(this.object.isOrthographicCamera){const a=new T(this._mouse.x,this._mouse.y,0);a.unproject(this.object);const l=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),r=l!==this.object.zoom;const c=new T(this._mouse.x,this._mouse.y,0);c.unproject(this.object),this.object.position.sub(c).add(a),this.object.updateMatrixWorld(),o=Se.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;o!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(o).add(this.object.position):(Fr.origin.copy(this.object.position),Fr.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(Fr.direction))<f_?this.object.lookAt(this.target):(dh.setFromNormalAndCoplanarPoint(this.object.up,this.target),Fr.intersectPlane(dh,this.target))))}else if(this.object.isOrthographicCamera){const o=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),o!==this.object.zoom&&(this.object.updateProjectionMatrix(),r=!0)}return this._scale=1,this._performCursorZoom=!1,r||this._lastPosition.distanceToSquared(this.object.position)>la||8*(1-this._lastQuaternion.dot(this.object.quaternion))>la||this._lastTargetPosition.distanceToSquared(this.target)>la?(this.dispatchEvent(uh),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(t){return t!==null?$e/60*this.autoRotateSpeed*t:$e/60/60*this.autoRotateSpeed}_getZoomScale(t){const e=Math.abs(t*.01);return Math.pow(.95,this.zoomSpeed*e)}_rotateLeft(t){this._sphericalDelta.theta-=t}_rotateUp(t){this._sphericalDelta.phi-=t}_panLeft(t,e){Se.setFromMatrixColumn(e,0),Se.multiplyScalar(-t),this._panOffset.add(Se)}_panUp(t,e){this.screenSpacePanning===!0?Se.setFromMatrixColumn(e,1):(Se.setFromMatrixColumn(e,0),Se.crossVectors(this.object.up,Se)),Se.multiplyScalar(t),this._panOffset.add(Se)}_pan(t,e){const n=this.domElement;if(this.object.isPerspectiveCamera){const s=this.object.position;Se.copy(s).sub(this.target);let r=Se.length();r*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*t*r/n.clientHeight,this.object.matrix),this._panUp(2*e*r/n.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(t*(this.object.right-this.object.left)/this.object.zoom/n.clientWidth,this.object.matrix),this._panUp(e*(this.object.top-this.object.bottom)/this.object.zoom/n.clientHeight,this.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1)}_dollyOut(t){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=t:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_dollyIn(t){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=t:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_updateZoomParameters(t,e){if(!this.zoomToCursor)return;this._performCursorZoom=!0;const n=this.domElement.getBoundingClientRect(),s=t-n.left,r=e-n.top,o=n.width,a=n.height;this._mouse.x=s/o*2-1,this._mouse.y=-(r/a)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(t){return Math.max(this.minDistance,Math.min(this.maxDistance,t))}_handleMouseDownRotate(t){this._rotateStart.set(t.clientX,t.clientY)}_handleMouseDownDolly(t){this._updateZoomParameters(t.clientX,t.clientX),this._dollyStart.set(t.clientX,t.clientY)}_handleMouseDownPan(t){this._panStart.set(t.clientX,t.clientY)}_handleMouseMoveRotate(t){this._rotateEnd.set(t.clientX,t.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);const e=this.domElement;this._rotateLeft($e*this._rotateDelta.x/e.clientHeight),this._rotateUp($e*this._rotateDelta.y/e.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(t){this._dollyEnd.set(t.clientX,t.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(t){this._panEnd.set(t.clientX,t.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(t){this._updateZoomParameters(t.clientX,t.clientY),t.deltaY<0?this._dollyIn(this._getZoomScale(t.deltaY)):t.deltaY>0&&this._dollyOut(this._getZoomScale(t.deltaY)),this.update()}_handleKeyDown(t){let e=!1;switch(t.code){case this.keys.UP:t.ctrlKey||t.metaKey||t.shiftKey?this._rotateUp($e*this.rotateSpeed/this.domElement.clientHeight):this._pan(0,this.keyPanSpeed),e=!0;break;case this.keys.BOTTOM:t.ctrlKey||t.metaKey||t.shiftKey?this._rotateUp(-$e*this.rotateSpeed/this.domElement.clientHeight):this._pan(0,-this.keyPanSpeed),e=!0;break;case this.keys.LEFT:t.ctrlKey||t.metaKey||t.shiftKey?this._rotateLeft($e*this.rotateSpeed/this.domElement.clientHeight):this._pan(this.keyPanSpeed,0),e=!0;break;case this.keys.RIGHT:t.ctrlKey||t.metaKey||t.shiftKey?this._rotateLeft(-$e*this.rotateSpeed/this.domElement.clientHeight):this._pan(-this.keyPanSpeed,0),e=!0;break}e&&(t.preventDefault(),this.update())}_handleTouchStartRotate(t){if(this._pointers.length===1)this._rotateStart.set(t.pageX,t.pageY);else{const e=this._getSecondPointerPosition(t),n=.5*(t.pageX+e.x),s=.5*(t.pageY+e.y);this._rotateStart.set(n,s)}}_handleTouchStartPan(t){if(this._pointers.length===1)this._panStart.set(t.pageX,t.pageY);else{const e=this._getSecondPointerPosition(t),n=.5*(t.pageX+e.x),s=.5*(t.pageY+e.y);this._panStart.set(n,s)}}_handleTouchStartDolly(t){const e=this._getSecondPointerPosition(t),n=t.pageX-e.x,s=t.pageY-e.y,r=Math.sqrt(n*n+s*s);this._dollyStart.set(0,r)}_handleTouchStartDollyPan(t){this.enableZoom&&this._handleTouchStartDolly(t),this.enablePan&&this._handleTouchStartPan(t)}_handleTouchStartDollyRotate(t){this.enableZoom&&this._handleTouchStartDolly(t),this.enableRotate&&this._handleTouchStartRotate(t)}_handleTouchMoveRotate(t){if(this._pointers.length==1)this._rotateEnd.set(t.pageX,t.pageY);else{const n=this._getSecondPointerPosition(t),s=.5*(t.pageX+n.x),r=.5*(t.pageY+n.y);this._rotateEnd.set(s,r)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);const e=this.domElement;this._rotateLeft($e*this._rotateDelta.x/e.clientHeight),this._rotateUp($e*this._rotateDelta.y/e.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(t){if(this._pointers.length===1)this._panEnd.set(t.pageX,t.pageY);else{const e=this._getSecondPointerPosition(t),n=.5*(t.pageX+e.x),s=.5*(t.pageY+e.y);this._panEnd.set(n,s)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(t){const e=this._getSecondPointerPosition(t),n=t.pageX-e.x,s=t.pageY-e.y,r=Math.sqrt(n*n+s*s);this._dollyEnd.set(0,r),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);const o=(t.pageX+e.x)*.5,a=(t.pageY+e.y)*.5;this._updateZoomParameters(o,a)}_handleTouchMoveDollyPan(t){this.enableZoom&&this._handleTouchMoveDolly(t),this.enablePan&&this._handleTouchMovePan(t)}_handleTouchMoveDollyRotate(t){this.enableZoom&&this._handleTouchMoveDolly(t),this.enableRotate&&this._handleTouchMoveRotate(t)}_addPointer(t){this._pointers.push(t.pointerId)}_removePointer(t){delete this._pointerPositions[t.pointerId];for(let e=0;e<this._pointers.length;e++)if(this._pointers[e]==t.pointerId){this._pointers.splice(e,1);return}}_isTrackingPointer(t){for(let e=0;e<this._pointers.length;e++)if(this._pointers[e]==t.pointerId)return!0;return!1}_trackPointer(t){let e=this._pointerPositions[t.pointerId];e===void 0&&(e=new H,this._pointerPositions[t.pointerId]=e),e.set(t.pageX,t.pageY)}_getSecondPointerPosition(t){const e=t.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[e]}_customWheelEvent(t){const e=t.deltaMode,n={clientX:t.clientX,clientY:t.clientY,deltaY:t.deltaY};switch(e){case 1:n.deltaY*=16;break;case 2:n.deltaY*=100;break}return t.ctrlKey&&!this._controlActive&&(n.deltaY*=10),n}}function m_(i){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(i.pointerId),this.domElement.addEventListener("pointermove",this._onPointerMove),this.domElement.addEventListener("pointerup",this._onPointerUp)),!this._isTrackingPointer(i)&&(this._addPointer(i),i.pointerType==="touch"?this._onTouchStart(i):this._onMouseDown(i)))}function g_(i){this.enabled!==!1&&(i.pointerType==="touch"?this._onTouchMove(i):this._onMouseMove(i))}function v_(i){switch(this._removePointer(i),this._pointers.length){case 0:this.domElement.releasePointerCapture(i.pointerId),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(Vu),this.state=le.NONE;break;case 1:const t=this._pointers[0],e=this._pointerPositions[t];this._onTouchStart({pointerId:t,pageX:e.x,pageY:e.y});break}}function __(i){let t;switch(i.button){case 0:t=this.mouseButtons.LEFT;break;case 1:t=this.mouseButtons.MIDDLE;break;case 2:t=this.mouseButtons.RIGHT;break;default:t=-1}switch(t){case Zi.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(i),this.state=le.DOLLY;break;case Zi.ROTATE:if(i.ctrlKey||i.metaKey||i.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(i),this.state=le.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(i),this.state=le.ROTATE}break;case Zi.PAN:if(i.ctrlKey||i.metaKey||i.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(i),this.state=le.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(i),this.state=le.PAN}break;default:this.state=le.NONE}this.state!==le.NONE&&this.dispatchEvent(zl)}function M_(i){switch(this.state){case le.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(i);break;case le.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(i);break;case le.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(i);break}}function x_(i){this.enabled===!1||this.enableZoom===!1||this.state!==le.NONE||(i.preventDefault(),this.dispatchEvent(zl),this._handleMouseWheel(this._customWheelEvent(i)),this.dispatchEvent(Vu))}function y_(i){this.enabled===!1||this.enablePan===!1||this._handleKeyDown(i)}function b_(i){switch(this._trackPointer(i),this._pointers.length){case 1:switch(this.touches.ONE){case $i.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(i),this.state=le.TOUCH_ROTATE;break;case $i.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(i),this.state=le.TOUCH_PAN;break;default:this.state=le.NONE}break;case 2:switch(this.touches.TWO){case $i.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(i),this.state=le.TOUCH_DOLLY_PAN;break;case $i.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(i),this.state=le.TOUCH_DOLLY_ROTATE;break;default:this.state=le.NONE}break;default:this.state=le.NONE}this.state!==le.NONE&&this.dispatchEvent(zl)}function S_(i){switch(this._trackPointer(i),this.state){case le.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(i),this.update();break;case le.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(i),this.update();break;case le.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(i),this.update();break;case le.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(i),this.update();break;default:this.state=le.NONE}}function w_(i){this.enabled!==!1&&i.preventDefault()}function E_(i){i.key==="Control"&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function T_(i){i.key==="Control"&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}const So=.03;function rr(i,t,e,n,s,r){const o=[];for(let a=0;a<=r;a++){const l=n+(s-n)*a/r;o.push(new H(i+Math.cos(l)*e,t+Math.sin(l)*e))}return o}function A_(i,t){const e=[];for(let n=0;n<i.length;n++){const s=i[Math.max(0,n-1)],r=i[Math.min(i.length-1,n+1)],o=r.x-s.x,a=r.y-s.y,l=Math.hypot(o,a)||1,c=a/l,h=-o/l;e.push(new H(Math.max(0,i[n].x-c*t),i[n].y-h*t))}return e}function ca(i){const t=[];for(const e of i){const n=t[t.length-1];(!n||n.distanceTo(e)>1e-4)&&t.push(e)}return t}function wo(i,t,e,n){const s=n.bottomY??0,r=A_(t,e),o=t[t.length-1],a=r[r.length-1],l=(o.x+a.x)/2,c=(o.x-a.x)/2,h=Math.max(o.y,a.y),u=rr(l,h,c*1.25,0,Math.PI,8).map(M=>new H(M.x,M.y)),d=h+c*1.25,f=ca([new H(0,s),...t]),g=n.roundBottom?r[0].y:Math.max(r[0].y,s+e),_=ca([new H(0,g),...r.map(M=>new H(M.x,Math.max(M.y,g)))]),m=ca([...f,...u,...[..._].reverse()]);let p=0;for(const M of m)p=Math.max(p,M.x);const x={type:i,shell:m,inner:_,outer:f,wall:e,rimY:d,innerBottomY:g,innerTopY:a.y,maxOuterRadius:Math.max(p,n.footRadius??0),rimOuterRadius:o.x+c*.25,rimInnerRadius:a.x,spout:n.spout??0,nominalMl:n.nominalMl,graduations:n.graduations,gradTitle:n.gradTitle,baseOffsetY:(n.baseOffsetY??0)+So,footHeight:n.footHeight??0,footRadius:n.footRadius??0,rack:n.rack??!1,volTable:new Float32Array(1),volStep:.02};return C_(x),x}function C_(i){const t=i.innerTopY-i.innerBottomY,e=Math.max(2,Math.ceil(t/i.volStep)+1),n=new Float32Array(e);let s=0,r=xe(i,i.innerBottomY);for(let o=1;o<e;o++){const a=i.innerBottomY+o*i.volStep,l=xe(i,a);s+=Math.PI*i.volStep*(r*r+r*l+l*l)/3,n[o]=s,r=l}i.volTable=n}function xe(i,t){const e=i.inner;if(t<=e[0].y)return t<e[0].y-1e-6?0:R_(e,t);for(let n=0;n<e.length-1;n++){const s=e[n],r=e[n+1];if(!(r.y-s.y<1e-6)&&t>=s.y&&t<=r.y){const o=(t-s.y)/(r.y-s.y);return s.x+(r.x-s.x)*o}}return e[e.length-1].x}function R_(i,t){let e=0;for(const n of i)Math.abs(n.y-t)<1e-4&&(e=Math.max(e,n.x));return e}function Bs(i,t){const e=i.outer;for(let n=0;n<e.length-1;n++){const s=e[n],r=e[n+1];if(!(r.y-s.y<1e-6)&&t>=s.y&&t<=r.y)return s.x+(r.x-s.x)*(t-s.y)/(r.y-s.y)}return t<e[0].y?e[0].x:e[e.length-1].x}function Js(i,t){if(t<=0)return i.innerBottomY;const e=i.volTable,n=e.length;if(t>=e[n-1]){const a=i.rimInnerRadius;return i.innerBottomY+(n-1)*i.volStep+(t-e[n-1])/(Math.PI*a*a)}let s=0,r=n-1;for(;r-s>1;){const a=s+r>>1;e[a]<t?s=a:r=a}const o=s+(t-e[s])/Math.max(1e-9,e[r]-e[s]);return i.innerBottomY+o*i.volStep}function ks(i,t,e,n=0){const s=[];if(n>0)for(let r=n;r<=t+1e-6;r+=n)Math.abs(r/i-Math.round(r/i))<1e-6||s.push({ml:r,major:!1});for(let r=i;r<=t+1e-6;r+=i){const o=Math.abs(r/e-Math.round(r/e))<1e-6;s.push({ml:r,major:!0,label:o?String(Math.round(r)):void 0})}return s}function ha(i,t,e,n,s,r){const o=Math.min(.55,t*.18),a=[...rr(t-o,o,o,-Math.PI/2,0,6),new H(t,e*.5),new H(t,e-.25)];return wo(i,a,n,{nominalMl:s,graduations:r,gradTitle:`${s} mL`,spout:Math.max(.35,t*.11)})}function P_(){const o=[...rr(3.65,.6,.6,-Math.PI/2,.2,7)],a=new H(1.7+.45,9.2),l=o[o.length-1];for(let c=1;c<=6;c++){const h=c/6;o.push(new H(l.x+(a.x-l.x)*h,l.y+(a.y-l.y)*h))}for(let c=1;c<=5;c++){const h=c/5,u=1-(1-h)*(1-h);o.push(new H(a.x+(1.7-a.x)*u,9.2+(10.2-9.2)*h))}return o.push(new H(1.7,13.5-.6)),o.push(new H(1.7+.12,13.5-.3)),wo("erlenmeyer-250",o,.18,{nominalMl:250,graduations:ks(50,250,50,25).filter(c=>c.ml<=250),gradTitle:"250 mL"})}function L_(){const n=[...rr(1.32,1.3,.3,-Math.PI/2,0,4),new H(1.62,12.75),new H(1.62,24.3)];return wo("cylinder-100",n,.17,{nominalMl:100,graduations:ks(10,100,10,1),gradTitle:"100 mL",spout:.35,bottomY:1,footHeight:1,footRadius:3.8})}function I_(){const e=[...rr(0,1.25,1.25,-Math.PI/2+.12,0,10),new H(1.25,7.5),new H(1.25,14.75)];return wo("test-tube",e,.11,{nominalMl:30,graduations:[],gradTitle:"",roundBottom:!0,baseOffsetY:1.2,rack:!0})}const fh=new Map;function D_(i){let t=fh.get(i);if(t)return t;switch(i){case"beaker-50":t=ha(i,2.1,5.5,.14,50,ks(10,50,10));break;case"beaker-1000":t=ha(i,5.25,14.5,.22,1e3,ks(100,1e3,200,50));break;case"erlenmeyer-250":t=P_();break;case"cylinder-100":t=L_();break;case"test-tube":t=I_();break;case"beaker-250":default:t=ha("beaker-250",3.5,9.5,.18,250,ks(50,250,50,25));break}return fh.set(i,t),t}function U_(i){return i.rimY+i.baseOffsetY}function N_(i){return i.rack?6.5:i.maxOuterRadius+i.spout}const Gu={value:800};function ph(i,t){Gu.value=i/(2*Math.tan(Il.degToRad(t)/2))}class Qr{points;cap;live=0;pos;vel;col;life;maxLife;size0;size1;alpha;gravity;drag;kind;seed;aSize;aAlpha;geo;material;fadeIn=.15;behaviour;constructor(t,e,n={}){this.cap=t,this.pos=new Float32Array(t*3),this.vel=new Float32Array(t*3),this.col=new Float32Array(t*3),this.life=new Float32Array(t),this.maxLife=new Float32Array(t),this.size0=new Float32Array(t),this.size1=new Float32Array(t),this.alpha=new Float32Array(t),this.gravity=new Float32Array(t),this.drag=new Float32Array(t),this.kind=new Uint8Array(t),this.seed=new Float32Array(t),this.aSize=new Float32Array(t),this.aAlpha=new Float32Array(t),this.geo=new pe,this.geo.setAttribute("position",new Re(this.pos,3).setUsage(Qn)),this.geo.setAttribute("aColor",new Re(this.col,3).setUsage(Qn)),this.geo.setAttribute("aSize",new Re(this.aSize,1).setUsage(Qn)),this.geo.setAttribute("aAlpha",new Re(this.aAlpha,1).setUsage(Qn)),this.geo.setDrawRange(0,0),this.geo.boundingSphere=new si(new T,1e4),this.material=new nn({uniforms:{uMap:{value:e},uScale:Gu},vertexShader:`
        attribute float aSize;
        attribute float aAlpha;
        attribute vec3 aColor;
        uniform float uScale;
        varying float vA;
        varying vec3 vC;
        void main() {
          vec4 mv = modelViewMatrix * vec4( position, 1.0 );
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp( aSize * uScale / max( -mv.z, 0.1 ), 0.0, 512.0 );
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
        }`,transparent:!0,depthWrite:!1,blending:n.additive?Ws:xi}),this.points=new Lv(this.geo,this.material),this.points.frustumCulled=!1,this.points.renderOrder=n.renderOrder??4,this.points.raycast=()=>{},this.points.visible=!1}spawn(t,e,n,s,r,o,a,l,c,h,u,d,f,g=0,_=0,m=0){if(this.live>=this.cap)return-1;const p=this.live++,x=p*3;return this.pos[x]=t,this.pos[x+1]=e,this.pos[x+2]=n,this.vel[x]=s,this.vel[x+1]=r,this.vel[x+2]=o,this.col[x]=u,this.col[x+1]=d,this.col[x+2]=f,this.life[p]=0,this.maxLife[p]=a,this.size0[p]=l,this.size1[p]=c,this.alpha[p]=h,this.gravity[p]=g,this.drag[p]=_,this.kind[p]=m,this.seed[p]=Math.random()*100,p}kill(t){const e=--this.live;if(t===e)return;const n=t*3,s=e*3;for(let r=0;r<3;r++)this.pos[n+r]=this.pos[s+r],this.vel[n+r]=this.vel[s+r],this.col[n+r]=this.col[s+r];this.life[t]=this.life[e],this.maxLife[t]=this.maxLife[e],this.size0[t]=this.size0[e],this.size1[t]=this.size1[e],this.alpha[t]=this.alpha[e],this.gravity[t]=this.gravity[e],this.drag[t]=this.drag[e],this.kind[t]=this.kind[e],this.seed[t]=this.seed[e]}clear(){this.live=0}update(t){let e=0;for(;e<this.live;){if(this.life[e]+=t,this.life[e]>=this.maxLife[e]||this.behaviour&&!this.behaviour(e,t)){this.kill(e);continue}const n=e*3;this.vel[n+1]-=this.gravity[e]*t;const s=Math.max(0,1-this.drag[e]*t);this.vel[n]*=s,this.vel[n+1]*=s,this.vel[n+2]*=s,this.pos[n]+=this.vel[n]*t,this.pos[n+1]+=this.vel[n+1]*t,this.pos[n+2]+=this.vel[n+2]*t;const r=this.life[e]/this.maxLife[e];this.aSize[e]=this.size0[e]+(this.size1[e]-this.size0[e])*r;const o=this.fadeIn>0?Math.min(1,r/this.fadeIn):1,a=Math.min(1,(1-r)/.35);this.aAlpha[e]=this.alpha[e]*o*a,e++}this.geo.setDrawRange(0,this.live),this.points.visible=this.live>0,this.live>0&&(this.geo.attributes.position.needsUpdate=!0,this.geo.attributes.aColor.needsUpdate=!0,this.geo.attributes.aSize.needsUpdate=!0,this.geo.attributes.aAlpha.needsUpdate=!0)}setRenderOrder(t){this.points.renderOrder=t}dispose(){this.geo.dispose(),this.material.dispose()}}let ua=null;function O_(){return ua||(ua=new nr(1,2)),ua}function F_(){return new nn({uniforms:{uTint:{value:new St(1,1,1)},uOpacity:{value:1}},vertexShader:`
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
      }`,transparent:!0,depthWrite:!1})}class B_{mesh;material;cap;live=0;p;v;r;wob;age;squash;m=new Jt;q=new _e;s=new T;t=new T;constructor(t){this.cap=t,this.material=F_(),this.mesh=new Cs(O_(),this.material,t),this.mesh.instanceMatrix.setUsage(Qn),this.mesh.count=0,this.mesh.frustumCulled=!1,this.mesh.renderOrder=4,this.mesh.raycast=()=>{},this.mesh.visible=!1,this.p=new Float32Array(t*3),this.v=new Float32Array(t),this.r=new Float32Array(t),this.wob=new Float32Array(t),this.age=new Float32Array(t),this.squash=new Float32Array(t)}spawn(t,e,n,s,r,o=0){if(this.live>=this.cap)return;const a=this.live++;this.p[a*3]=t,this.p[a*3+1]=e,this.p[a*3+2]=n,this.r[a]=s,this.v[a]=r,this.wob[a]=Math.random()*6.28,this.age[a]=0,this.squash[a]=o}kill(t){const e=--this.live;t!==e&&(this.p[t*3]=this.p[e*3],this.p[t*3+1]=this.p[e*3+1],this.p[t*3+2]=this.p[e*3+2],this.r[t]=this.r[e],this.v[t]=this.v[e],this.wob[t]=this.wob[e],this.age[t]=this.age[e],this.squash[t]=this.squash[e])}clear(){this.live=0,this.mesh.count=0,this.mesh.visible=!1}update(t,e,n,s,r){let o=0;for(;o<this.live;){const a=o*3;this.age[o]+=t;const l=Math.min(1,this.age[o]/.12),c=this.v[o]*l;let h=this.p[a],u=this.p[a+1]+c*t,d=this.p[a+2];const f=this.wob[o]+this.age[o]*(9+this.r[o]*20),g=.25*this.r[o]+.02;if(h+=Math.cos(f)*g*t*6,d+=Math.sin(f*1.3)*g*t*6,s!==0){const M=Math.cos(s*t),v=Math.sin(s*t),A=h*M-d*v;d=h*v+d*M,h=A}this.r[o]*=1+t*.04;const _=Math.max(.05,n(u)-this.r[o]),m=Math.hypot(h,d);if(m>_&&(h*=_/m,d*=_/m),u+this.r[o]*.3>=e){r(h,e,d,this.r[o]),this.kill(o);continue}this.p[a]=h,this.p[a+1]=u,this.p[a+2]=d;const p=this.r[o],x=this.squash[o];if(x>0){const M=Math.sin(this.age[o]*14+this.wob[o])*.18*x;this.s.set(p*(1.15+M),p*(.8-M),p*(1.1-M*.5))}else this.s.set(p,p*.92,p);this.t.set(h,u,d),this.m.compose(this.t,this.q,this.s),this.mesh.setMatrixAt(o,this.m),o++}this.mesh.count=this.live,this.mesh.visible=this.live>0,this.live>0&&(this.mesh.instanceMatrix.needsUpdate=!0)}setRenderOrder(t){this.mesh.renderOrder=t}dispose(){this.material.dispose(),this.mesh.dispose()}}const k_=(()=>{const i=new ze(1,1,1,1);return i.translate(0,.5,0),i})();function z_(i=0){return new nn({uniforms:{uTime:{value:0},uSeed:{value:i},uLum:{value:0},uEmit:{value:new St(1,.8,.2)},uEmitAmt:{value:0},uIntensity:{value:0},uSize:{value:new H(2,5)},uInnerCone:{value:1}},vertexShader:`
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
      }`,transparent:!0,depthWrite:!1,blending:Ws,toneMapped:!1})}class Wu{group=new fe;meshes=[];mats=[];offsets=[];intensity=0;target=0;constructor(t){for(let e=0;e<t;e++){const n=z_(e*1.37+Math.random()),s=new J(k_,n);s.frustumCulled=!1,s.renderOrder=900,s.raycast=()=>{},this.meshes.push(s),this.mats.push(n),this.offsets.push(new H),this.group.add(s)}this.group.visible=!1}configure(t,e,n,s){const r=this.meshes.length;for(let o=0;o<r;o++){const a=o/r*Math.PI*2+.4,l=r===1?0:t*(o===0?0:.55);this.offsets[o].set(Math.cos(a)*l,Math.sin(a)*l),this.meshes[o].position.set(this.offsets[o].x,0,this.offsets[o].y);const c=this.mats[o],h=o===0?1:.75;c.uniforms.uSize.value.set(e*h,n*h*(.85+.3*Math.sin(o*2.1))),s.luminosity!==void 0&&(c.uniforms.uLum.value=s.luminosity),s.emitter&&c.uniforms.uEmit.value.copy(s.emitter),s.emitterAmount!==void 0&&(c.uniforms.uEmitAmt.value=s.emitterAmount)}}setInnerCone(t){for(const e of this.mats)e.uniforms.uInnerCone.value=t?1:0}setTarget(t){this.target=Math.max(0,t)}tick(t,e){if(this.intensity+=(this.target-this.intensity)*Math.min(1,t*6),this.target===0&&this.intensity<.01&&(this.intensity=0),this.group.visible=this.intensity>.005,!this.group.visible)return;const n=.85+.15*Math.sin(e*23)*Math.sin(e*7.3);for(const s of this.mats)s.uniforms.uTime.value=e,s.uniforms.uIntensity.value=this.intensity*n}brightness(t){return this.intensity*(.8+.2*Math.sin(t*31)*Math.sin(t*11.7))}dispose(){for(const t of this.mats)t.dispose()}}function Ne(i,t){const e=document.createElement("canvas");return e.width=i,e.height=t,[e,e.getContext("2d")]}function ni(i){let t=i>>>0;return()=>{t=t+1831565813>>>0;let e=t;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}}function Oe(i,t,e=!1){const n=new vo(i);return t&&(n.colorSpace=we),e&&(n.wrapS=ss,n.wrapT=ss),n.anisotropy=8,n.needsUpdate=!0,n}const mh=new Map;function Ee(i,t){let e=mh.get(i);return e||(e=t(),mh.set(i,e)),e}function Ml(){return Ee("soft",()=>{const[i,t]=Ne(64,64),e=t.createRadialGradient(32,32,0,32,32,32);return e.addColorStop(0,"rgba(255,255,255,1)"),e.addColorStop(.35,"rgba(255,255,255,0.65)"),e.addColorStop(1,"rgba(255,255,255,0)"),t.fillStyle=e,t.fillRect(0,0,64,64),Oe(i,!1)})}function H_(){return Ee("smoke",()=>{const[t,e]=Ne(128,128),n=ni(7);e.clearRect(0,0,128,128);for(let r=0;r<26;r++){const o=n()*Math.PI*2,a=n()*128*.22,l=128/2+Math.cos(o)*a,c=128/2+Math.sin(o)*a,h=128*(.16+n()*.2),u=e.createRadialGradient(l,c,0,l,c,h);u.addColorStop(0,`rgba(255,255,255,${.18+n()*.12})`),u.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=u,e.fillRect(0,0,128,128)}const s=e.getImageData(0,0,128,128);for(let r=0;r<128;r++)for(let o=0;o<128;o++){const a=(o-64)/64,l=(r-128/2)/(128/2),c=Math.max(0,1-Math.sqrt(a*a+l*l)),h=(r*128+o)*4+3;s.data[h]=Math.min(255,s.data[h]*Math.min(1,c*2.2))}return e.putImageData(s,0,0),Oe(t,!1)})}function V_(){return Ee("ring",()=>{const[t,e]=Ne(256,256),n=e.createRadialGradient(256/2,256/2,256*.3,256/2,256/2,256/2);return n.addColorStop(0,"rgba(255,255,255,0)"),n.addColorStop(.45,"rgba(255,255,255,0.9)"),n.addColorStop(.6,"rgba(255,255,255,0.35)"),n.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=n,e.fillRect(0,0,256,256),Oe(t,!1)})}function G_(){return Ee("blob",()=>{const[t,e]=Ne(128,128),n=e.createRadialGradient(128/2,128/2,0,128/2,128/2,128/2);return n.addColorStop(0,"rgba(0,0,0,0.85)"),n.addColorStop(.55,"rgba(0,0,0,0.5)"),n.addColorStop(.8,"rgba(0,0,0,0.12)"),n.addColorStop(1,"rgba(0,0,0,0)"),e.fillStyle=n,e.fillRect(0,0,128,128),Oe(t,!1)})}function W_(){return Ee("droplets",()=>{const[t,e]=Ne(512,512),n=ni(42);e.clearRect(0,0,512,512),e.fillStyle="rgba(255,255,255,0.10)",e.fillRect(0,0,512,512);const s=(r,o,a)=>{const l=e.createRadialGradient(r-a*.3,o-a*.35,a*.05,r,o,a);l.addColorStop(0,"rgba(255,255,255,0.95)"),l.addColorStop(.35,"rgba(235,242,248,0.35)"),l.addColorStop(.85,"rgba(200,210,220,0.55)"),l.addColorStop(1,"rgba(200,210,220,0)"),e.fillStyle=l,e.beginPath(),e.ellipse(r,o,a,a*(.9+n()*.25),0,0,Math.PI*2),e.fill()};for(let r=0;r<2600;r++)s(n()*512,n()*512,.8+Math.pow(n(),3)*3.5);for(let r=0;r<90;r++)s(n()*512,n()*512,4+n()*6);for(let r=0;r<7;r++){const o=n()*512;let a=n()*512*.5;const l=60+n()*200;e.strokeStyle="rgba(230,238,245,0.35)",e.lineWidth=2+n()*2,e.beginPath(),e.moveTo(o,a);for(let c=0;c<l;c+=8)a+=8,e.lineTo(o+Math.sin(c*.05)*1.5,a);e.stroke(),s(o,a,4+n()*3)}return Oe(t,!1,!0)})}function q_(){const i=Ee("counter_map",()=>{const[n,s]=Ne(1024,1024),r=ni(11);s.fillStyle="#25282b",s.fillRect(0,0,1024,1024);for(let o=0;o<160;o++){const a=r()*1024,l=r()*1024,c=40+r()*140,h=s.createRadialGradient(a,l,0,a,l,c),u=r()<.5?"255,255,255":"0,0,0";h.addColorStop(0,`rgba(${u},0.035)`),h.addColorStop(1,`rgba(${u},0)`),s.fillStyle=h,s.fillRect(a-c,l-c,c*2,c*2)}for(let o=0;o<26e3;o++){const a=r();s.fillStyle=a<.5?`rgba(120,124,128,${.15+r()*.3})`:`rgba(10,10,12,${.2+r()*.3})`;const l=r()<.97?1:2;s.fillRect(r()*1024,r()*1024,l,l)}return Oe(n,!0,!0)}),t=Ee("counter_rough",()=>{const[n,s]=Ne(512,512),r=ni(13);s.fillStyle="rgb(105,105,105)",s.fillRect(0,0,512,512);for(let o=0;o<220;o++){const a=r()*512,l=r()*512,c=20+r()*90,h=s.createRadialGradient(a,l,0,a,l,c),u=r()<.5?150:70;h.addColorStop(0,`rgba(${u},${u},${u},0.35)`),h.addColorStop(1,`rgba(${u},${u},${u},0)`),s.fillStyle=h,s.fillRect(a-c,l-c,c*2,c*2)}s.strokeStyle="rgba(160,160,160,0.08)";for(let o=0;o<60;o++){s.lineWidth=4+r()*10,s.beginPath();const a=r()*512,l=r()*512;s.arc(a,l,30+r()*120,r()*6,r()*6+1.5),s.stroke()}return Oe(n,!1,!0)});return{map:i,roughnessMap:t}}function Y_(){const i=t=>{const[n,s]=Ne(1024,1024),r=ni(21),o=1024/4,a=1024/8,l=6;s.fillStyle=t==="map"?"#b9bcbc":t==="rough"?"rgb(235,235,235)":"rgb(0,0,0)",s.fillRect(0,0,1024,1024);for(let c=0;c<8;c++){const h=c%2===0?0:o/2;for(let u=-1;u<5;u++){const d=u*o+h+l/2,f=c*a+l/2,g=o-l,_=a-l;if(t==="map"){const m=238+Math.floor(r()*10),p=s.createLinearGradient(d,f,d,f+_);p.addColorStop(0,`rgb(${m},${m},${m-2})`),p.addColorStop(1,`rgb(${m-8},${m-8},${m-9})`),s.fillStyle=p}else t==="rough"?s.fillStyle="rgb(40,40,40)":s.fillStyle="rgb(255,255,255)";s.beginPath(),s.roundRect(d,f,g,_,7),s.fill(),t==="bump"&&(s.strokeStyle="rgba(0,0,0,0.25)",s.lineWidth=6,s.stroke())}}return Oe(n,t==="map",!0)};return{map:Ee("tile_map",()=>i("map")),roughnessMap:Ee("tile_rough",()=>i("rough")),bumpMap:Ee("tile_bump",()=>i("bump"))}}function X_(i="#d9dcd6"){return Ee("paint"+i,()=>{const[e,n]=Ne(512,512),s=ni(31);n.fillStyle=i,n.fillRect(0,0,512,512);for(let r=0;r<9e3;r++)n.fillStyle=s()<.5?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)",n.fillRect(s()*512,s()*512,2,2);return Oe(e,!0,!0)})}function qu(){return Ee("wood",()=>{const[e,n]=Ne(1024,128),s=ni(5);n.fillStyle="#a77b4f",n.fillRect(0,0,1024,128);for(let r=0;r<90;r++){const o=s()*128,a=2+s()*6,l=.002+s()*.01;n.strokeStyle=s()<.5?`rgba(90,58,30,${.12+s()*.2})`:`rgba(210,170,120,${.08+s()*.12})`,n.lineWidth=.6+s()*2.2,n.beginPath();for(let c=0;c<=1024;c+=8){const h=o+Math.sin(c*l+r)*a;c===0?n.moveTo(c,h):n.lineTo(c,h)}n.stroke()}return Oe(e,!0,!0)})}function $_(){return Ee("floor",()=>{const[t,e]=Ne(512,512),n=ni(3);e.fillStyle="#8d9293",e.fillRect(0,0,512,512);for(let s=0;s<12e3;s++){const r=n();e.fillStyle=r<.33?"rgba(255,255,255,0.18)":r<.66?"rgba(40,44,48,0.18)":"rgba(120,130,140,0.25)",e.fillRect(n()*512,n()*512,2+n()*2,2+n()*2)}return e.strokeStyle="rgba(60,60,60,0.25)",e.lineWidth=2,e.strokeRect(0,0,512,512),Oe(t,!0,!0)})}function j_(){return Ee("cabinet",()=>{const[e,n]=Ne(1024,512);n.fillStyle="#d4d8d6",n.fillRect(0,0,1024,512);const s=4;for(let r=0;r<s;r++){const o=r*1024/s;n.strokeStyle="rgba(0,0,0,0.35)",n.lineWidth=4,n.strokeRect(o+6,8,1024/s-12,110),n.strokeRect(o+6,130,1024/s-12,372),n.fillStyle="#8a9096",n.fillRect(o+1024/s/2-40,52,80,10),n.fillRect(o+1024/s/2-40,160,80,10)}return Oe(e,!0)})}function K_(){return Ee("window",()=>{const[e,n]=Ne(512,512),s=n.createLinearGradient(0,0,0,512);s.addColorStop(0,"#dfeefc"),s.addColorStop(.6,"#f4f8fb"),s.addColorStop(1,"#e8eef0"),n.fillStyle=s,n.fillRect(0,0,512,512),n.fillStyle="rgba(150,170,160,0.35)",n.beginPath(),n.moveTo(0,512*.78);for(let r=0;r<=512;r+=16)n.lineTo(r,512*.78-Math.abs(Math.sin(r*.03))*40-Math.sin(r*.011)*20);return n.lineTo(512,512),n.lineTo(0,512),n.fill(),n.fillStyle="#c9cdd0",n.fillRect(512/2-6,0,12,512),n.fillRect(0,512/2-6,512,12),n.lineWidth=16,n.strokeStyle="#c9cdd0",n.strokeRect(0,0,512,512),Oe(e,!0)})}function Z_(){return Ee("hotglow",()=>{const[t,e]=Ne(256,256);e.fillStyle="#000",e.fillRect(0,0,256,256);const n=e.createRadialGradient(256/2,256/2,0,256/2,256/2,256*.48);n.addColorStop(0,"rgba(255,90,20,0.55)"),n.addColorStop(.7,"rgba(255,60,10,0.4)"),n.addColorStop(1,"rgba(255,40,0,0)"),e.fillStyle=n,e.fillRect(0,0,256,256);for(let s=18;s<256*.44;s+=13)e.strokeStyle="rgba(255,120,40,0.85)",e.lineWidth=5,e.beginPath(),e.arc(256/2,256/2,s,0,Math.PI*2),e.stroke();return Oe(t,!0)})}function J_(){return Ee("hottop",()=>{const[t,e]=Ne(256,256);return e.fillStyle="#eef0ee",e.fillRect(0,0,256,256),e.strokeStyle="rgba(120,120,120,0.45)",e.lineWidth=2,e.beginPath(),e.arc(256/2,256/2,256*.4,0,Math.PI*2),e.stroke(),e.fillStyle="rgba(200,40,30,0.7)",e.font="bold 14px sans-serif",e.textAlign="center",e.fillText("⚠ HOT SURFACE",256/2,242),Oe(t,!0)})}function Q_(i,t,e,n){return Ee("grad_"+i,()=>{const r=n?2048:1024,[o,a]=Ne(256,r);a.clearRect(0,0,256,r),a.fillStyle="rgba(250,250,248,0.96)",a.strokeStyle="rgba(250,250,248,0.96)";const l=n?30:34;for(const h of t){const u=(1-h.v)*r,d=h.major?n?90:80:45;a.fillRect(256*.5-d,u-(h.major?2.5:1.6),d,h.major?5:3.2),h.label&&(a.font=`600 ${l}px "Helvetica Neue", Arial, sans-serif`,a.textAlign="left",a.textBaseline="middle",a.fillText(h.label,256*.5+10,u))}if(e){a.font=`600 ${l}px "Helvetica Neue", Arial, sans-serif`,a.textAlign="center",a.textBaseline="middle";const h=t.length?(1-Math.max(...t.map(d=>d.v)))*r:r*.2,u=Math.max(l,h-l*1.6);a.fillText(e,256*.5,u),a.font=`500 ${Math.round(l*.6)}px Arial, sans-serif`,a.fillText("BORO 3.3",256*.5,u+l*.95)}const c=Oe(o,!0);return c.anisotropy=4,c})}function tM(){return Ee("thermoscale",()=>{const[e,n]=Ne(64,2048);n.fillStyle="#f3f1e8",n.fillRect(0,0,64,2048),n.fillStyle="#1b1b1b";for(let s=-20;s<=110;s+=1){const o=2048-(s+20)/130*2048*.96-2048*.02,a=s%10===0,l=s%5===0;n.fillRect(0,o-1,a?30:l?22:14,a?3:2),a&&(n.save(),n.translate(54,o),n.rotate(-Math.PI/2),n.font="bold 18px Arial",n.textAlign="center",n.fillText(String(s),0,0),n.restore())}return Oe(e,!0)})}let eM=null,nM=null,iM=null,bs=null,fi=null,Ss=null,Br=null;const gh=new Map;function sM(){return eM??=new Bl(1,0)}function rM(){return nM??=new nr(1,1)}function oM(){return iM??=new nr(1,1)}function aM(){if(bs)return bs;const i=new us;return i.moveTo(0,0),i.lineTo(1,.15),i.lineTo(.35,1),i.lineTo(0,0),bs=new Ci(i,{depth:.06,bevelEnabled:!1}),bs.center(),bs}function Yu(){if(fi)return fi;const i=40,t=[],e=[],n=5,s=.32;for(let r=0;r<=i;r++){const o=r/i,a=(o-.5)*n,l=Math.sin(o*Math.PI*2.2)*.35+o*.2,c=Math.cos(o*Math.PI*1.3)*.45,h=Math.sin(o*5)*.4;t.push(a,l+Math.cos(h)*s*.5,c+Math.sin(h)*s*.5),t.push(a,l-Math.cos(h)*s*.5,c-Math.sin(h)*s*.5)}for(let r=0;r<i;r++){const o=r*2;e.push(o,o+1,o+2,o+1,o+3,o+2)}return fi=new pe,fi.setAttribute("position",new jt(t,3)),fi.setIndex(e),fi.computeVertexNormals(),fi}function lM(){return Ss||(Ss=new Mo(.3,1.6,6,16),Ss.rotateZ(Math.PI/2),Ss)}function cM(){if(Br)return Br;const i=[new H(0,0),new H(.8,0),new H(.82,.02),new H(1,.94),new H(.98,1),new H(0,1)];return Br=new Ue(i,32),Br}function hM(i){let t=gh.get(i.type);if(t)return t;const e=i.inner.filter(n=>n.x>.01).map(n=>new H(Math.max(.01,n.x-.03),n.y));return t=new Ue(e,48),gh.set(i.type,t),t}const uM=()=>new sn({color:16777215,roughness:.08,metalness:0,clearcoat:1,clearcoatRoughness:.05,envMapIntensity:2.2,transparent:!0,opacity:.9,flatShading:!0}),Yn=new Jt,pi=new _e,vh=new ln,Xn=new T,an=new T,_h=new St;function Rt(i,t){return i+Math.random()*(t-i)}function Qe(i,t){const e=Math.sin(i*127.1+t*311.7)*43758.5453;return e-Math.floor(e)}class dM{constructor(t,e){this.profile=t,this.liquid=e;const n=t;this.floorY=-n.baseOffsetY,this.bubbles=new B_(220),this.smoke=new Qr(170,H_()),this.smoke.fadeIn=.2,this.splash=new Qr(140,Ml()),this.splash.fadeIn=0,this.precip=new Qr(300,Ml()),this.precip.fadeIn=.3,this.flame=new Wu(n.rimInnerRadius>2?4:2),this.group.add(this.bubbles.mesh,this.smoke.points,this.splash.points,this.precip.points,this.flame.group),this.smoke.behaviour=(a,l)=>this.smokeBehaviour(a,l),this.splash.behaviour=(a,l)=>this.splashBehaviour(a,l),this.precip.behaviour=(a,l)=>this.precipBehaviour(a,l),this.foamMat=new vt({color:16777215,roughness:.3,metalness:0,envMapIntensity:1.2}),this.foam=new Cs(oM(),this.foamMat,260),this.foam.count=0,this.foam.visible=!1,this.foam.frustumCulled=!1,this.foam.raycast=()=>{},this.foam.instanceMatrix.setUsage(Qn);for(let a=0;a<260;a++){const l=Math.floor(a/52);this.foamCells.push({u:Math.sqrt(Math.random()),v:Math.random()*Math.PI*2,layer:l,r:Rt(.6,1.25),ph:Math.random()*6.28}),this.foam.setColorAt(a,_h.setScalar(Rt(.9,1)))}this.group.add(this.foam),this.condMat=new nn({uniforms:{uMap:{value:W_()},uAmount:{value:0},uFill:e.uniforms.uFill,uTop:{value:n.innerTopY}},vertexShader:`
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
        }`,transparent:!0,depthWrite:!1,side:je}),this.cond=new J(hM(n),this.condMat),this.cond.visible=!1,this.cond.raycast=()=>{},this.group.add(this.cond),this.bedMat=new vt({color:16777215,roughness:.92,metalness:0}),this.crystals=new Cs(sM(),uM(),48),this.crystals.count=0,this.crystals.visible=!1,this.crystals.raycast=()=>{},this.lumps=new Cs(rM(),new vt({color:16777215,roughness:.7,transparent:!0,opacity:.92}),40),this.lumps.count=0,this.lumps.visible=!1,this.lumps.raycast=()=>{},this.lumps.instanceMatrix.setUsage(Qn),this.group.add(this.crystals,this.lumps),this.ribbonMat=new vt({color:13158604,metalness:1,roughness:.32,side:je}),this.ribbon=new J(Yu(),this.ribbonMat),this.ribbon.visible=!1,this.ribbon.castShadow=!1,this.ribbon.raycast=()=>{};const s=Math.min(1,(n.rimInnerRadius*2-.4)/5);this.ribbon.userData.baseScale=Math.max(.35,s),this.group.add(this.ribbon),this.stirBar=new J(lM(),new vt({color:16185074,roughness:.45,metalness:0}));const r=Math.min(1.25,xe(n,n.innerBottomY+.3)*2*.8/2.2);this.stirBar.scale.setScalar(Math.max(.35,r)),this.stirBar.position.y=n.innerBottomY+.3*this.stirBar.scale.y,this.stirBar.visible=!1,this.stirBar.raycast=()=>{},this.group.add(this.stirBar),this.stopper=new J(cM(),new vt({color:5974556,roughness:.75,metalness:0}));const o=n.rimInnerRadius+.25;this.stopper.scale.set(o,Math.min(3,Math.max(1.6,o*1.1)),o),this.stopper.userData.homeY=n.rimY-this.stopper.scale.y*.65,this.stopper.position.y=this.stopper.userData.homeY,this.stopper.castShadow=!0,this.stopper.visible=!1,this.stopper.raycast=()=>{},this.group.add(this.stopper),this.setRenderOrderBase(0)}group=new fe;onBurst;snap=null;bubbles;smoke;splash;precip;flame;foam;foamMat;foamCells=[];foamLevel=0;foamTarget=0;cond;condMat;condLevel=0;bedSide=null;bedTop=null;bedMat;bed={yb:0,rp:0,H:0,rS:0,wet:!1,vol:-1};bedTargetVol=0;bedVol=0;bedColor=new St(1,1,1);bedColorTarget=new St(1,1,1);bedSeed=Math.random()*10;crystals;crystalCount=0;crystalPolar=[];lumps;lumpCount=0;lumpState=[];ribbon;ribbonMat;ribbonScale=0;ribbonTarget=0;ribbonFloating=!1;stirBar;stirRpm=0;stirAngle=0;stopper;stopperFlying=!1;stopperV=new T;stopperW=new T;stopperT=0;sealed=!1;shards=null;shardState=[];puddle=null;puddleMat=null;puddleR=0;puddleTarget=0;burst=!1;seenEvents=new Set;spawnAcc={bubbles:0,boil:0,steam:0,fume:0,precip:0,spill:0};spillTime=0;suspendedColor=new St(1,1,1);suspendedTargetCount=0;suspendedDiameterUm=10;settleFrac=0;time=0;appHex="";appColor=new St(1,1,1);renderBase=0;floorY;setRenderOrderBase(t){this.renderBase=t,this.bubbles.setRenderOrder(t+4),this.precip.setRenderOrder(t+4),this.splash.setRenderOrder(t+4),this.smoke.setRenderOrder(t+6),this.cond.renderOrder=t+4,this.crystals.renderOrder=t+4,this.lumps.renderOrder=t+4,this.flame.group.children.forEach(e=>e.renderOrder=t+4),this.shards&&(this.shards.renderOrder=t+6),this.puddle&&(this.puddle.renderOrder=t)}stopperTopY(){return this.stopper.userData.homeY+this.stopper.scale.y}setSealed(t){this.burst&&(t=!1),t&&!this.sealed&&(this.stopperFlying=!1,this.stopper.position.set(0,this.stopper.userData.homeY,0),this.stopper.rotation.set(0,0,0)),this.sealed=t,this.stopperFlying||(this.stopper.visible=t)}setStirring(t){this.stirRpm=Math.max(0,t),this.liquid.setStirring(this.stirRpm)}applySnapshot(t){this.snap=t,t.sealed!==this.sealed&&!t.burst&&this.setSealed(t.sealed);for(const n of t.events||[]){const s=`${n.kind}@${n.t_sim_s.toFixed(3)}`;this.seenEvents.has(s)||(this.seenEvents.add(s),this.seenEvents.size>300&&this.seenEvents.clear(),n.kind==="stopper_pop"?this.popStopper():n.kind==="burst"?this.triggerBurst():n.kind==="boil_over"?this.spillTime=1.6:n.kind==="splatter"&&this.spatter(10))}t.burst&&!this.burst&&this.triggerBurst(),this.foamTarget=Math.max(0,Math.min(1,t.foam)),this.condLevel=Math.max(0,Math.min(1,t.condensation)),this.liquid.setBoil(t.boil_intensity);let e=0;for(const n of t.gas_fluxes)e+=n.rate_ml_s;this.liquid.setGasAgitation(Math.min(1,e/4)),this.processSolids(t.solids,t.total_liquid_ml)}processSolids(t,e){let n=0,s=0,r=0,o=0,a=0,l=0,c=0,h=0,u=0,d=0,f=0,g=0,_=.92,m=null,p=0;const x=new St(1,1,1);for(const A of t){if(A.mass_g<=1e-6)continue;if(A.kind==="metal"){m||(m=A);continue}const E=1-Math.max(0,Math.min(1,A.suspended_fraction)),R=Math.max(0,A.settled_volume_ml)*E;n+=R;const P=A.mass_g*E+1e-9;r+=A.rgb[0]*P,o+=A.rgb[1]*P,a+=A.rgb[2]*P,s+=P;const b=A.mass_g*A.suspended_fraction;e>.05&&(l+=b,c+=A.rgb[0]*b,h+=A.rgb[1]*b,u+=A.rgb[2]*b,p+=A.particle_diameter_um*b),A.kind==="crystal"&&(d+=A.mass_g*E,_=Math.min(_,.35)),(A.kind==="gel"||A.kind==="curds")&&(f+=A.mass_g,g+=b,x.setRGB(A.rgb[0],A.rgb[1],A.rgb[2]),_=Math.min(_,A.kind==="gel"?.4:.8))}this.bedTargetVol=n,s>0&&this.bedColorTarget.setRGB(r/s,o/s,a/s),this.bedMat.roughness=_,l>1e-5?(this.suspendedColor.setRGB(c/l,h/l,u/l),this.suspendedDiameterUm=p/l,this.suspendedTargetCount=Math.min(this.precip.cap,Math.floor(30+Math.sqrt(l)*520))):this.suspendedTargetCount=0;const M=d>1e-4?Math.min(48,Math.floor(6+Math.sqrt(d)*40)):0;M!==this.crystalCount&&(this.crystalCount=M,this.layoutCrystals(s>0?this.bedColorTarget:new St(1,1,1)));const v=f>1e-4?Math.min(40,Math.floor(4+Math.sqrt(f)*30)):0;v!==this.lumpCount&&(this.lumpCount=v,this.layoutLumps(x,f>0?g/f:0)),m?(this.ribbonTarget=Math.max(.05,Math.min(1,m.remaining_fraction??1)),this.ribbonFloating=!!m.floating,this.ribbonMat.color.setRGB(m.rgb[0],m.rgb[1],m.rgb[2])):this.ribbonTarget=0}layoutCrystals(t){const e=this.profile,n=this.crystalCount;this.crystals.count=n,this.crystals.visible=n>0,this.crystalPolar=[];for(let s=0;s<n;s++)this.crystalPolar.push({a:Qe(s,1)*Math.PI*2,f:Math.sqrt(Qe(s,2)),s:(.07+Qe(s,3)*.13)*Math.min(1.2,e.rimInnerRadius/3),rot:Qe(s,4)}),this.crystals.setColorAt(s,_h.copy(t).multiplyScalar(.85+Qe(s,8)*.25));this.crystals.instanceColor&&(this.crystals.instanceColor.needsUpdate=!0),this.placeCrystals()}placeCrystals(){const t=this.crystalCount;if(t===0)return;const e=Math.max(.1,Math.max(this.bed.rS,this.bed.rp)*.85);for(let n=0;n<t;n++){const s=this.crystalPolar[n];if(!s)break;const r=s.f*e,o=s.s;an.set(Math.cos(s.a)*r,this.bedSurfaceAt(r)+o*.4,Math.sin(s.a)*r),pi.setFromEuler(vh.set(Qe(n,4)*3,Qe(n,5)*3,Qe(n,6)*3)),Xn.set(o,o*(1.1+Qe(n,7)*.7),o),Yn.compose(an,pi,Xn),this.crystals.setMatrixAt(n,Yn)}this.crystals.instanceMatrix.needsUpdate=!0}layoutLumps(t,e){const n=this.profile,s=this.lumpCount;this.lumps.count=s,this.lumps.visible=s>0,this.lumps.material.color.copy(t),this.lumpState=[];for(let r=0;r<s;r++){const o=Qe(r,11)<e;this.lumpState.push({x:0,y:0,z:0,s:(.12+Qe(r,12)*.23)*Math.min(1.3,n.rimInnerRadius/3),floatY:Qe(r,13),susp:o,ph:Qe(r,14)*6.28})}}popStopper(){if(!this.stopper.visible&&!this.sealed)return;this.stopperFlying=!0,this.stopperT=0,this.stopper.visible=!0,this.stopperV.set(Rt(-25,25),Rt(160,220),Rt(-10,25)),this.stopperW.set(Rt(-12,12),Rt(-6,6),Rt(-12,12)),this.sealed=!1;const t=this.profile.rimY;for(let e=0;e<26;e++){const n=Math.random()*Math.PI*2,s=Rt(10,40);this.smoke.spawn(Math.cos(n)*.5,t+.5,Math.sin(n)*.5,Math.cos(n)*s,Rt(10,60),Math.sin(n)*s,Rt(.6,1.2),1,5,.22,.95,.96,.97,0,3.5,3)}}spatter(t){const e=this.liquid.fillY,n=new St(this.liquid.getApparentHex());for(let s=0;s<t;s++){const r=Math.random()*Math.PI*2;this.splash.spawn(Math.cos(r)*.5,e,Math.sin(r)*.5,Math.cos(r)*Rt(5,20),Rt(40,90),Math.sin(r)*Rt(5,20),1.5,.25,.2,.9,n.r,n.g,n.b,981,0,0)}}triggerBurst(){if(this.burst)return;this.burst=!0;const t=this.profile,e=this.liquid.volumeMl,n=new St(this.liquid.getApparentHex());this.onBurst?.(),this.bubbles.clear(),this.precip.clear(),this.foam.visible=!1,this.cond.visible=!1,this.crystals.visible=!1,this.lumps.visible=!1,this.ribbon.visible=!1,this.stirBar.visible=!1,this.bedSide&&(this.bedSide.visible=!1),this.bedTop&&(this.bedTop.visible=!1),this.sealed&&this.popStopper();const s=34,r=new sn({color:15923445,roughness:.04,metalness:0,transparent:!0,opacity:.38,envMapIntensity:2,clearcoat:1,side:je,depthWrite:!1});this.shards=new Cs(aM(),r,s),this.shards.frustumCulled=!1,this.shards.instanceMatrix.setUsage(Qn),this.shards.raycast=()=>{},this.group.add(this.shards);for(let o=0;o<s;o++){const a=Math.random()*Math.PI*2,l=Rt(.2,t.rimY),c=Bs(t,l),h=Rt(40,140);this.shardState.push({p:new T(Math.cos(a)*c,l,Math.sin(a)*c),v:new T(Math.cos(a)*h,Rt(30,160),Math.sin(a)*h),r:new ln(Rt(0,6),Rt(0,6),Rt(0,6)),w:new T(Rt(-20,20),Rt(-20,20),Rt(-20,20)),s:Rt(.4,1.6)*Math.min(1.5,t.rimInnerRadius/2.5),rest:!1})}for(let o=0;o<60;o++){const a=Math.random()*Math.PI*2,l=Rt(20,90);this.splash.spawn(Math.cos(a)*1,Rt(.5,Math.max(1,this.liquid.fillY)),Math.sin(a)*1,Math.cos(a)*l,Rt(20,120),Math.sin(a)*l,2,Rt(.2,.5),.15,.85,n.r,n.g,n.b,981,.2,0)}e>.5&&this.ensurePuddle(n,Math.min(30,Math.sqrt(e/(Math.PI*.22)))),this.setRenderOrderBase(this.renderBase)}ensurePuddle(t,e){if(this.puddle)this.puddleMat&&this.puddleMat.color.lerp(t,.5);else{this.puddleMat=new sn({color:t,roughness:.03,metalness:0,transparent:!0,opacity:.55,clearcoat:1,envMapIntensity:1.5,depthWrite:!1,polygonOffset:!0,polygonOffsetFactor:-2});const n=new $s(1,48),s=n.attributes.position;for(let r=1;r<s.count;r++){const o=s.getX(r),a=s.getY(r),l=Math.atan2(a,o),c=1+.12*Math.sin(l*3+1)+.08*Math.sin(l*7+2)+.05*Math.sin(l*11);s.setXY(r,o*c,a*c)}n.rotateX(-Math.PI/2),this.puddle=new J(n,this.puddleMat),this.puddle.position.y=this.floorY+.04,this.puddle.scale.setScalar(.01),this.puddle.raycast=()=>{},this.puddle.receiveShadow=!0,this.group.add(this.puddle),this.puddle.renderOrder=this.renderBase}this.puddleTarget=Math.max(this.puddleTarget,e)}splashAt(t,e,n,s,r){const o=this.liquid.fillY;this.liquid.impact(t,e,r,this.time);for(let a=0;a<s;a++){const l=Math.random()*Math.PI*2,c=Rt(3,14)*r;this.splash.spawn(t,o+.05,e,Math.cos(l)*c,Rt(15,45)*r,Math.sin(l)*c,.6,Rt(.08,.18),.06,.8,n.r,n.g,n.b,981,0,1)}}smokeBehaviour(t,e){const n=this.smoke.kind[t],s=t*3,r=this.smoke.pos,o=this.smoke.vel,a=this.profile,l=this.smoke.seed[t],c=this.smoke.life[t];if(n===0||n===1){o[s]+=Math.sin(c*1.7+l)*2.5*e,o[s+2]+=Math.cos(c*1.3+l*1.7)*2.5*e;const h=r[s+1];if(h<a.rimY){const u=Math.max(.2,xe(a,Math.min(h,a.innerTopY))-.3),d=Math.hypot(r[s],r[s+2]);d>u&&(r[s]*=u/d,r[s+2]*=u/d)}}else if(n===2){const h=r[s+1],u=Math.hypot(r[s],r[s+2])+1e-4,d=r[s]/u,f=r[s+2]/u,g=a.rimOuterRadius+.4;if(h>=a.rimY-.3&&u<g)o[s]+=d*9*e,o[s+2]+=f*9*e,o[s+1]=Math.max(o[s+1]-6*e,-.5);else if(u>=g&&h>this.floorY+.6){o[s+1]-=14*e,o[s+1]=Math.max(o[s+1],-8);const _=Bs(a,Math.max(0,Math.min(h,a.rimY)))+.6;u<_&&(r[s]=d*_,r[s+2]=f*_)}else if(h<=this.floorY+.6)r[s+1]=this.floorY+.6,o[s+1]=0,o[s]+=d*2.5*e,o[s+2]+=f*2.5*e;else if(h<a.rimY-.3){o[s+1]=Math.max(o[s+1],.8);const _=Math.max(.2,xe(a,Math.min(h,a.innerTopY))-.3);u>_&&(r[s]=d*_,r[s+2]=f*_)}}return!0}splashBehaviour(t,e){const n=this.splash.kind[t],s=t*3,r=this.splash.pos,o=this.splash.vel;if(n===1){if(o[s+1]<0&&r[s+1]<this.liquid.fillY)return!1}else if(n===4){const a=this.profile,l=r[s+1],c=Math.hypot(r[s],r[s+2])+1e-4,h=Bs(a,Math.max(0,Math.min(l,a.rimY)))+.15;l>this.floorY+.1?(r[s]*=h/c,r[s+2]*=h/c):(r[s+1]=this.floorY+.1,o[s+1]=0,o[s]=r[s]/c*2,o[s+2]=r[s+2]/c*2)}return r[s+1]<this.floorY+.05&&(r[s+1]=this.floorY+.05,o[s+1]=0,o[s]*=.5,o[s+2]*=.5),!0}precipBehaviour(t,e){const n=t*3,s=this.precip.pos,r=this.profile,o=this.liquid.fillY,a=this.precip.seed[t],l=this.stirRpm>0?Math.min(4.5,this.stirRpm/60*6.283*.12):.12+(this.snap?.boil_intensity??0)*2,c=s[n],h=s[n+2],u=Math.cos(l*e),d=Math.sin(l*e);s[n]=c*u-h*d,s[n+2]=c*d+h*u;const f=Math.min(1.2,.02+25e-5*this.suspendedDiameterUm*this.suspendedDiameterUm)*(this.stirRpm>0?.15:1);s[n+1]+=(-f+Math.sin(this.time*1.3+a)*.25)*e,s[n]+=Math.sin(this.time*2.1+a*3.1)*.15*e,s[n+2]+=Math.cos(this.time*1.9+a*2.3)*.15*e;const g=this.bedLevelY(),_=s[n+1];if(_<Math.max(g,r.innerBottomY)+.04)return!1;_>o-.05&&(s[n+1]=o-.05);const m=Math.max(.05,xe(r,s[n+1])-.08),p=Math.hypot(s[n],s[n+2]);return p>m&&(s[n]*=m/p,s[n+2]*=m/p),!0}tick(t,e){this.time=e;const n=this.snap,s=this.profile,r=this.liquid,o=r.fillY,a=r.volumeMl>.05&&!this.burst,l=r.surfaceRadius,c=r.getApparentHex();c!==this.appHex&&(this.appHex=c,this.appColor.set(c));const h=this.appColor;if(n&&a){for(const x of n.gas_fluxes)this.spawnGas(x,t,o);if(n.boil_intensity>.01)for(this.spawnAcc.boil+=n.boil_intensity*55*t;this.spawnAcc.boil>=1;){this.spawnAcc.boil-=1;const x=xe(s,s.innerBottomY+.3)*.8,M=Math.random()*Math.PI*2,v=Math.sqrt(Math.random())*x,A=Rt(.12,.42)*Math.min(1.2,s.rimInnerRadius/2.5)*(.5+n.boil_intensity*.6);this.bubbles.spawn(Math.cos(M)*v,s.innerBottomY+A,Math.sin(M)*v,A,Rt(16,32),1)}}const u=this.stirRpm>0?Math.min(4.5,this.stirRpm/60*6.283*.12):0,d={n:0};this.bubbles.material.uniforms.uTint.value.copy(h),this.bubbles.update(t,a?o:-1e3,x=>xe(s,Math.min(x,s.innerTopY)),u,(x,M,v,A)=>{if(d.n++,d.n<6&&(this.splash.spawn(x,M+.02,v,0,A*6,0,.12,A*1.6,A*3.2,.45,1,1,1,0,0,1),A>.12&&Math.random()<.5)){const E=Math.random()*6.28;this.splash.spawn(x,M+.05,v,Math.cos(E)*8,Rt(25,60),Math.sin(E)*8,.5,A*.5,A*.3,.8,h.r,h.g,h.b,981,0,1)}}),this.foamLevel+=(this.foamTarget-this.foamLevel)*Math.min(1,t*1.5),this.updateFoam(e,o,a,h);const f=this.cond.visible?this.condMat.uniforms.uAmount.value:0,g=this.burst?0:this.condLevel,_=f+(g-f)*Math.min(1,t*.8);if(this.condMat.uniforms.uAmount.value=_,this.cond.visible=_>.01,n&&!this.burst){const x=n.vapour_visibility;if(x>.01)for(this.spawnAcc.steam+=x*20*t;this.spawnAcc.steam>=1;){this.spawnAcc.steam-=1;const M=Math.random()*Math.PI*2,v=Math.sqrt(Math.random())*l*.8,A=a?o+.2:s.innerBottomY+.5,E=Math.min(2,l*.5);this.smoke.spawn(Math.cos(M)*v,A,Math.sin(M)*v,Rt(-.5,.5),Rt(3.5,7),Rt(-.5,.5),Rt(2.4,3.6),E,E*3.5+2,Math.min(.2,.06+x*.1),.94,.95,.97,-.6,.35,0)}for(const M of n.fumes)this.spawnFume(M,t,a?o:s.innerBottomY+.5,l)}if(this.spillTime>0&&!this.burst){for(this.spillTime-=t,this.spawnAcc.spill+=40*t;this.spawnAcc.spill>=1;){this.spawnAcc.spill-=1;const x=Math.random()*Math.PI*2,M=s.rimOuterRadius+.15,A=this.foamLevel>.2||Math.random()<.4?new St(.95,.96,.97):h;this.splash.spawn(Math.cos(x)*M,s.rimY,Math.sin(x)*M,0,Rt(-3,0),0,Rt(1.5,2.5),Rt(.35,.6),Rt(.5,.9),.85,A.r,A.g,A.b,60,.5,4)}this.ensurePuddle(h,s.maxOuterRadius+2.5)}const m=a?this.suspendedTargetCount:0;if(this.precip.live<m)for(this.spawnAcc.precip+=Math.max(30,m)*t*2;this.spawnAcc.precip>=1&&this.precip.live<m;){this.spawnAcc.precip-=1;const x=Rt(s.innerBottomY+.2,Math.max(s.innerBottomY+.3,o-.1)),M=xe(s,x)*.92,v=Math.random()*Math.PI*2,A=Math.sqrt(Math.random())*M,E=Rt(.85,1.1),R=this.suspendedColor,P=Rt(.12,.3)*Math.min(1.2,Math.max(.6,s.rimInnerRadius/3));this.precip.spawn(Math.cos(v)*A,x,Math.sin(v)*A,0,0,0,Rt(5,10),P,P*1.2,.7,R.r*E,R.g*E,R.b*E,0,0,0)}else if(this.precip.live>m+10)for(let x=m;x<this.precip.live;x++)this.precip.maxLife[x]=Math.min(this.precip.maxLife[x],this.precip.life[x]+.8);if(this.bedVol+=(this.bedTargetVol-this.bedVol)*Math.min(1,t*1.2),this.bedColor.lerp(this.bedColorTarget,Math.min(1,t*2)),this.bedMat.color.copy(this.bedColor),this.updateBed(),this.lumpCount>0&&!this.burst&&this.updateLumps(e,o,a),this.ribbonScale+=(this.ribbonTarget-this.ribbonScale)*Math.min(1,t*1.5),this.ribbonScale>.03&&!this.burst){this.ribbon.visible=!0;const x=this.ribbon.userData.baseScale,M=x*this.ribbonScale,v=n?n.gas_fluxes.some(b=>b.nucleation==="solid"&&b.rate_ml_s>.01):!1;this.ribbon.scale.set(M,x*(.6+.4*this.ribbonScale),x);const A=a?Math.max(s.innerBottomY+.4,o-.35):s.innerBottomY+.3,E=this.bedLevelY()+.35,R=this.ribbonFloating?A:E;this.ribbon.position.y+=(R-this.ribbon.position.y)*Math.min(1,t*2);const P=v?Math.sin(e*9)*.04:0;this.ribbon.position.y+=P,this.ribbon.rotation.set(.25+Math.sin(e*.7)*(v?.08:0),e*(v?.25:.02),.1)}else this.ribbon.visible=!1;this.stirRpm>0&&!this.burst?(this.stirBar.visible=!0,this.stirAngle+=Math.min(30,this.stirRpm/60*6.283)*t,this.stirBar.rotation.y=this.stirAngle):this.stirBar.visible=!1;const p=n?.flame;if(p&&p.power_w>.5&&!this.burst){const x=Math.min(24,3.5+Math.sqrt(p.power_w)*1.6),M=Math.max(1.5,l*1.5),v=p.emitter_rgb?new St(p.emitter_rgb[0],p.emitter_rgb[1],p.emitter_rgb[2]):void 0;this.flame.configure(l*.6,M,x,{luminosity:Math.max(0,Math.min(1,p.luminosity)),emitter:v,emitterAmount:v?.75:0}),this.flame.setTarget(Math.min(1.6,.6+p.power_w/300)),this.flame.group.position.y=a?o:s.innerBottomY+.2}else this.flame.setTarget(0);this.flame.tick(t,e),this.stopperFlying&&this.updateStopper(t),this.shards&&this.updateShards(t),this.puddle&&(this.puddleR+=(this.puddleTarget-this.puddleR)*Math.min(1,t*1.8),this.puddle.scale.setScalar(Math.max(.01,this.puddleR))),this.smoke.update(t),this.splash.update(t),this.precip.update(t)}spawnGas(t,e,n){if(t.rate_ml_s<=1e-4)return;const s=this.profile;let r=Math.max(.4,Math.min(6,t.bubble_diameter_mm||2)),o=t.rate_ml_s/(Math.PI/6*Math.pow(r/10,3));const a=170;o>a&&(r=Math.min(7,r*Math.cbrt(o/a)),o=a),this.spawnAcc.bubbles+=o*e;const l=r/20,c=Math.min(30,5+r*5.5),h=this.bedLevelY();let u=0;for(;this.spawnAcc.bubbles>=1&&u++<40;){this.spawnAcc.bubbles-=1;const d=l*Rt(.6,1.3);let f=0,g=0,_=0;const m=Math.max(s.innerBottomY+.2,n-.2);if(t.nucleation==="wall"){g=Rt(s.innerBottomY+.15,m);const p=xe(s,g)-d-.02,x=Math.random()*Math.PI*2;f=Math.cos(x)*p,_=Math.sin(x)*p}else if(t.nucleation==="solid")if(this.ribbon.visible)an.set(Rt(-2.5,2.5),Rt(-.3,.3),Rt(-.4,.4)),this.ribbon.localToWorld(an),this.group.worldToLocal(an),f=an.x,g=Math.min(an.y,m),_=an.z;else{g=Math.max(h,s.innerBottomY)+.05+d;const p=xe(s,g)*.85,x=Math.random()*Math.PI*2,M=Math.sqrt(Math.random())*p;f=Math.cos(x)*M,_=Math.sin(x)*M}else{g=Rt(s.innerBottomY+.15,m);const p=xe(s,g)*.9,x=Math.random()*Math.PI*2,M=Math.sqrt(Math.random())*p;f=Math.cos(x)*M,_=Math.sin(x)*M}this.bubbles.spawn(f,g,_,d,c*Rt(.8,1.2))}this.spawnAcc.bubbles>2&&(this.spawnAcc.bubbles=2)}spawnFume(t,e,n,s){if(!(t.intensity<=.005))for(this.spawnAcc.fume+=t.intensity*26*e;this.spawnAcc.fume>=1;){this.spawnAcc.fume-=1;const r=Math.random()*Math.PI*2,o=Math.sqrt(Math.random())*s*.8,a=Math.min(1.8,s*.5),l=Math.min(.5,.08+t.opacity*.35)*Math.min(1,.4+t.intensity);t.denser_than_air?this.smoke.spawn(Math.cos(r)*o,n+.2,Math.sin(r)*o,0,Rt(1.2,2.5),0,Rt(4,6),a,a*3+2,l,t.rgb[0],t.rgb[1],t.rgb[2],0,.6,2):this.smoke.spawn(Math.cos(r)*o,n+.2,Math.sin(r)*o,Rt(-.4,.4),Rt(3,6),Rt(-.4,.4),Rt(2.5,3.5),a,a*3+2,l,t.rgb[0],t.rgb[1],t.rgb[2],-.4,.3,1)}}updateFoam(t,e,n,s){const r=this.profile,o=n?this.foamLevel:0;if(o<.02){this.foam.visible=!1;return}const a=Math.max(.3,Math.min(r.rimY+1-e,1.2+r.rimInnerRadius*.8)),l=o*a,c=Math.min(.32,Math.max(.1,r.rimInnerRadius*.08)),h=c*1.3;let u=0;const d=(this.snap?.gas_fluxes.length??0)>0?1:.3;for(let f=0;f<this.foamCells.length;f++){const g=this.foamCells[f],_=g.layer*h;if(_>l+h*.5||g.layer===0&&g.u>.15+o*3)continue;const m=e+_+c*.4,p=Math.max(.1,xe(this.profile,Math.min(m,r.innerTopY))-c*.6),x=m>r.innerTopY?(m-r.innerTopY)*.6:0,M=g.u*(p+x),v=Math.sin(t*2.5+g.ph)*.08*d,A=c*g.r*(1+v)*(_>l?Math.max(.2,1-(_-l)/(h*.5)):1);an.set(Math.cos(g.v)*M,m,Math.sin(g.v)*M),Xn.set(A,A*.85,A),Yn.compose(an,pi.identity(),Xn),this.foam.setMatrixAt(u,Yn),u++}this.foam.count=u,this.foam.visible=u>0,this.foamMat.color.setRGB(.9+s.r*.1,.9+s.g*.1,.9+s.b*.1),this.foam.instanceMatrix.needsUpdate=!0}floorYAt(t){const e=this.profile.inner;for(let n=0;n<e.length-1;n++){const s=e[n],r=e[n+1];if(r.x>=t&&r.x>s.x&&s.x<=t)return s.y+(r.y-s.y)*(t-s.x)/Math.max(1e-6,r.x-s.x)}return this.profile.innerBottomY}bedSurfaceAt(t){const{yb:e,rp:n,H:s}=this.bed,r=n>1e-4?Math.max(0,1-t/n*(t/n)):0;return Math.max(this.floorYAt(t)+.012,e+s*r)}bedLevelY(){const t=this.profile;return this.bedVol<.003?t.innerBottomY:this.bed.yb+this.bed.H*.5}updateBed(){const t=this.profile,e=this.bedVol;if(e<.003||this.burst){this.bed.vol=-1,this.bedSide&&(this.bedSide.visible=!1),this.bedTop&&(this.bedTop.visible=!1);return}const n=this.liquid.volumeMl>.3,s=n?.2:.34,r=Math.max(.12,xe(t,t.innerBottomY+.25)-.05);let o=Math.cbrt(2*e/(Math.PI*s)),a=t.innerBottomY,l=s*o;if(o>r){o=r,l=s*r;const E=Math.PI*o*o*l/2;a=Js(t,Math.max(0,e-E))}a=Math.min(a,t.innerTopY-.4),l=Math.min(l,Math.max(.05,t.innerTopY-.2-a));const c=xe(t,Math.max(a,t.innerBottomY+.05))-.04,h=a>t.innerBottomY+.03,u=h?Math.max(.1,c):Math.max(.1,Math.min(o,c)),d=this.bed,f=d.vol>=0&&d.wet===n&&Math.abs(e-d.vol)/Math.max(e,.02)<.015;if(this.bed={yb:a,rp:o,H:l,rS:u,wet:n,vol:f?d.vol:e},f&&this.bedSide&&this.bedTop){this.bedSide.visible=h,this.bedTop.visible=!0;return}let g=null;if(h){const E=[];for(const R of t.inner)R.y<a&&E.push(new H(Math.max(0,R.x-.04),R.y+.01));E.push(new H(u,this.bedSurfaceAt(u))),g=new Ue(E,48)}const _=20,m=48,p=new Float32Array((1+_*m)*3),x=this.bedSeed,M=[],v=(E,R,P)=>{const b=this.bedSurfaceAt(P),y=o>1e-4?Math.max(0,1-P/o):0,I=(Math.sin(E*5.3+x)*Math.cos(R*4.1-x)*.5+Math.sin(E*12.1+R*9.7)*.25)*(.012+Math.min(.05,l*.12)*Math.min(1,y*2));return Math.min(t.innerTopY-.1,b+I)};p[0]=0,p[1]=v(0,0,0),p[2]=0;for(let E=1;E<=_;E++){const R=u*E/_;for(let P=0;P<m;P++){const b=P/m*Math.PI*2,y=Math.cos(b)*R,I=Math.sin(b)*R,F=(1+(E-1)*m+P)*3;p[F]=y,p[F+1]=v(y,I,R),p[F+2]=I}}for(let E=0;E<m;E++)M.push(0,1+(E+1)%m,1+E);for(let E=1;E<_;E++){const R=1+(E-1)*m,P=1+E*m;for(let b=0;b<m;b++){const y=(b+1)%m;M.push(R+b,R+y,P+b,R+y,P+y,P+b)}}const A=new pe;A.setAttribute("position",new Re(p,3)),A.setIndex(M),A.computeVertexNormals(),this.bedTop?(this.bedTop.geometry.dispose(),this.bedTop.geometry=A,this.bedSide.geometry.dispose(),this.bedSide.geometry=g??new pe):(this.bedTop=new J(A,this.bedMat),this.bedTop.raycast=()=>{},this.bedTop.receiveShadow=!0,this.bedTop.frustumCulled=!1,this.bedSide=new J(g??new pe,this.bedMat),this.bedSide.raycast=()=>{},this.bedSide.receiveShadow=!0,this.bedSide.frustumCulled=!1,this.group.add(this.bedSide,this.bedTop)),this.bedSide.visible=h,this.bedTop.visible=!0,this.placeCrystals()}updateLumps(t,e,n){const s=this.profile,r=Math.max(this.bedLevelY(),s.innerBottomY);for(let o=0;o<this.lumpCount;o++){const a=this.lumpState[o];let l;a.susp&&n?l=r+.3+a.floatY*Math.max(.2,e-r-.6)+Math.sin(t*.6+a.ph)*.15:l=r+a.s*.5;const c=Math.max(.1,xe(s,l)-a.s),h=a.ph+(a.susp?t*.15:0)+(this.stirRpm>0?t*1.5:0),u=c*(.2+.75*(a.ph*7.3%1));a.x=Math.cos(h)*u,a.z=Math.sin(h)*u,a.y=l,an.set(a.x,a.y,a.z),pi.setFromEuler(vh.set(a.ph,a.ph*2,0)),Xn.set(a.s,a.s*.7,a.s*.9),Yn.compose(an,pi,Xn),this.lumps.setMatrixAt(o,Yn)}this.lumps.instanceMatrix.needsUpdate=!0}updateStopper(t){this.stopperT+=t;const e=this.stopper;this.stopperV.y-=981*t,e.position.addScaledVector(this.stopperV,t),e.rotation.x+=this.stopperW.x*t,e.rotation.y+=this.stopperW.y*t,e.rotation.z+=this.stopperW.z*t;const n=this.floorY+e.scale.y*.5;e.position.y<n&&(e.position.y=n,this.stopperV.y=Math.abs(this.stopperV.y)*.35,this.stopperV.x*=.6,this.stopperV.z*=.6,this.stopperW.multiplyScalar(.5),this.stopperV.y<20&&(this.stopperV.set(0,0,0),this.stopperW.set(0,0,0),e.rotation.x=Math.PI/2)),this.stopperT>6&&(this.stopperFlying=!1,e.visible=this.sealed,e.position.set(0,e.userData.homeY,0),e.rotation.set(0,0,0))}updateShards(t){const e=this.shards;let n=!1;for(let s=0;s<this.shardState.length;s++){const r=this.shardState[s];if(!r.rest){n=!0,r.v.y-=981*t,r.p.addScaledVector(r.v,t),r.r.x+=r.w.x*t,r.r.y+=r.w.y*t,r.r.z+=r.w.z*t;const o=this.floorY+.04;r.p.y<o&&(r.p.y=o,r.v.y=Math.abs(r.v.y)*.25,r.v.x*=.45,r.v.z*=.45,r.w.multiplyScalar(.4),r.v.y<15&&(r.rest=!0,r.r.x=Math.PI/2+Rt(-.1,.1),r.r.y=Rt(-.1,.1)))}pi.setFromEuler(r.r),Xn.setScalar(r.s),Yn.compose(r.p,pi,Xn),e.setMatrixAt(s,Yn)}e.count=this.shardState.length,n&&(e.instanceMatrix.needsUpdate=!0)}flameStrength(t){return this.flame.brightness(t)}flameLocalY(){return this.flame.group.position.y+3}isAnimating(){return this.stopperFlying||!!this.shards&&this.shardState.some(t=>!t.rest)||this.stirRpm>0||this.bubbles.live>0}dispose(){this.bubbles.dispose(),this.smoke.dispose(),this.splash.dispose(),this.precip.dispose(),this.flame.dispose(),this.foamMat.dispose(),this.foam.dispose(),this.condMat.dispose(),this.bedMat.dispose(),this.bedSide?.geometry.dispose(),this.bedTop?.geometry.dispose(),this.crystals.material.dispose(),this.crystals.dispose(),this.lumps.material.dispose(),this.lumps.dispose(),this.ribbonMat.dispose(),this.stirBar.material.dispose(),this.stopper.material.dispose(),this.shards&&(this.shards.material.dispose(),this.shards.dispose()),this.puddle&&(this.puddle.geometry.dispose(),this.puddleMat?.dispose())}}const fM={tint:15923445,baseAlpha:.035,fresnelAlpha:.55,edgeTint:7316885,roughness:.03,envMapIntensity:1.6};function ao(i,t={}){const e={...fM,...t},n=new sn({color:e.tint,metalness:0,roughness:e.roughness,ior:1.47,specularIntensity:1,clearcoat:.6,clearcoatRoughness:.02,envMapIntensity:e.envMapIntensity,transparent:!0,opacity:e.baseAlpha,depthWrite:!1,side:je});n.blending=uo,n.blendEquation=_n,n.blendSrc=yi,n.blendDst=qs,n.blendSrcAlpha=yi,n.blendDstAlpha=qs,n.defines={...n.defines||{},...i?{GLASS_FAR:""}:{GLASS_NEAR:""}};const s=new St(e.edgeTint),r=e.fresnelAlpha;return n.onBeforeCompile=o=>{o.uniforms.uFresnelAlpha={value:r},o.uniforms.uEdgeTint={value:s},o.vertexShader=o.vertexShader.replace("#include <common>",`#include <common>
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
        }`)},n.customProgramCacheKey=()=>i?"glass_far":"glass_near",n}let da=null;function Xu(){return da||(da=[ao(!0),ao(!1)]),da}function Qs(i,t=Xu()){const e=new J(i,t[1]),n=new J(i,t[0]);return e.renderOrder=5,n.renderOrder=1,e.add(n),{near:e,far:n}}const xl=32,pM=400,mM=10;function $u(i,t,e){if(!i||!i.rgb_weights||i.rgb_weights.length<xl*3)return[.95,.98,1];let n=0,s=0,r=0;for(let o=0;o<xl;o++){const a=t[o]||0,l=Math.pow(10,-a*e);n+=i.rgb_weights[o*3+0]*l,s+=i.rgb_weights[o*3+1]*l,r+=i.rgb_weights[o*3+2]*l}return[Math.max(0,Math.min(1,n)),Math.max(0,Math.min(1,s)),Math.max(0,Math.min(1,r))]}const De=4,lo=`
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
`,ju=`
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
`,Ku=`
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
      if ( t1 > 0.02 ) t = min( t, t1 );
      if ( t2 > 0.02 ) t = min( t, t2 );
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
  // Even "clear" water is not invisible: a faint blue-green absorption over the chord gives the liquid body
  // a readable tint (and makes the level visible) without needing any per-reagent data.
  od += vec3( 0.030, 0.016, 0.009 ) * tExit;
  return od + vec3( sod );
}
`,Mh=new Map;let In=null;function gM(i){let t=Mh.get(i.type);if(t)return t;const e=i.inner.map(s=>new H(Math.max(0,s.x-.02),s.y+.005));t=new Ue(e,64);const n=t.attributes.position.count;return t.setAttribute("aTop",new Re(new Float32Array(n),1)),Mh.set(i.type,t),t}function vM(){if(In)return In;const i=22,t=72,e=[],n=[],s=[],r=[];e.push(0,0,0),n.push(0,1,0),s.push(1);for(let o=1;o<=i;o++){const a=o/i,l=Math.min(.995,1-Math.pow(1-a,1.7));for(let c=0;c<t;c++){const h=c/t*Math.PI*2;e.push(Math.cos(h)*l,0,Math.sin(h)*l),n.push(0,1,0),s.push(1)}}for(let o=0;o<t;o++)r.push(0,1+(o+1)%t,1+o);for(let o=1;o<i;o++){const a=1+(o-1)*t,l=1+o*t;for(let c=0;c<t;c++){const h=(c+1)%t;r.push(a+c,a+h,l+c),r.push(a+h,l+h,l+c)}}return In=new pe,In.setAttribute("position",new jt(e,3)),In.setAttribute("normal",new jt(n,3)),In.setAttribute("aTop",new jt(s,1)),In.setIndex(r),In.boundingSphere=new si(new T,1e4),In}function _M(){const i=()=>Array.from({length:De},()=>new T);return{uFill:{value:0},uYb:{value:0},uR:{value:1},uConeA:{value:1},uConeB:{value:0},uTime:{value:0},uRipple:{value:.004},uVortex:{value:0},uMeniscus:{value:.09},uTopClamp:{value:100},uSlosh:{value:new H},uUpObj:{value:new T(0,1,0)},uImpact:{value:new ie(0,0,-100,0)},uLayerCount:{value:1},uLayerTop:{value:new Array(De).fill(0)},uKOld:{value:i()},uKNew:{value:i()},uScat:{value:Array.from({length:De},()=>new ie(1,1,1,0))},uMix:{value:1}}}function MM(i){const t=new nn({uniforms:i,vertexShader:`
      ${lo}
      ${ju}
      void main() {
        vec3 n;
        vec3 p = lqDisplace( position, n );
        vObj = p;
        vTop = aTop;
        vec3 camObj = ( inverse( modelMatrix ) * vec4( cameraPosition, 1.0 ) ).xyz;
        vRay = p - camObj;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
      }`,fragmentShader:`
      ${lo}
      ${Ku}
      void main() {
        if ( vTop < 0.5 && vObj.y > lqSurfY( vObj.xz ) ) discard;
        vec3 sc; float sa;
        vec3 od = lqOptics( sc, sa );
        vec3 T = exp( -od );
        if ( vTop < 0.5 ) {
          // refraction hint: a liquid column bends light away at its silhouette, so edges read darker
          vec3 nrm = normalize( vec3( vObj.x, 0.0, vObj.z ) + vec3( 1e-4 ) );
          float edge = 1.0 - abs( dot( nrm, normalize( vRay ) ) );
          T *= mix( 1.0, 0.62, pow( edge, 3.0 ) );
        }
        gl_FragColor = vec4( pow( T, vec3( 1.0 / 2.2 ) ), 1.0 );
      }`,transparent:!0,depthWrite:!1,side:bn});return t.blending=uo,t.blendEquation=_n,t.blendSrc=no,t.blendDst=tu,t.blendSrcAlpha=no,t.blendDstAlpha=yi,t.toneMapped=!1,t}function xM(i){const t=new sn({color:16777215,roughness:.035,metalness:0,ior:1.333,specularIntensity:1,envMapIntensity:1.25,transparent:!0,depthWrite:!1,side:bn});return t.blending=uo,t.blendEquation=_n,t.blendSrc=yi,t.blendDst=yi,t.blendSrcAlpha=no,t.blendDstAlpha=yi,t.onBeforeCompile=e=>{Object.assign(e.uniforms,i),e.vertexShader=e.vertexShader.replace("#include <common>",`#include <common>
${lo}
${ju}`).replace("#include <beginnormal_vertex>",`vec3 lqN;
        vec3 lqP = lqDisplace( position, lqN );
        vec3 objectNormal = lqN;
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3( tangent.xyz );
        #endif`).replace("#include <begin_vertex>",`vec3 transformed = lqP;
        vObj = lqP;
        vTop = aTop;
        vRay = lqP - ( inverse( modelMatrix ) * vec4( cameraPosition, 1.0 ) ).xyz;`),e.fragmentShader=e.fragmentShader.replace("#include <common>",`#include <common>
${lo}
${Ku}`).replace("#include <color_fragment>",`#include <color_fragment>
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
          float lqLine = vTop < 0.5 ? 1.0 - smoothstep( 0.0, 0.11, lqSY - vObj.y ) : 0.0;
          vec3 lqBase = vTop > 0.5 ? vec3( 0.045, 0.05, 0.055 ) : vec3( 0.0 );
          gl_FragColor = vec4( totalDiffuse * lqSa * 1.1 + lqSpec * specScale + vec3( 0.16 ) * iface + vec3( 0.32, 0.34, 0.36 ) * lqLine + lqBase, 1.0 );
        }`)},t.customProgramCacheKey=()=>"liquid_surface_v2",t}const xh=new T,yh=new Jt;function yM(i,t,e){return"#"+new St().setRGB(Math.min(1,Math.max(0,i)),Math.min(1,Math.max(0,t)),Math.min(1,Math.max(0,e)),ii).getHexString(we)}class bM{constructor(t){this.profile=t,this.uniforms=_M(),this.uniforms.uYb.value=t.innerBottomY,this.uniforms.uTopClamp.value=t.innerTopY-.05,this._fillY=t.innerBottomY,this.Lref=Math.max(1,2*xe(t,t.innerBottomY+1)*.8),this.absorbMat=MM(this.uniforms),this.surfaceMat=xM(this.uniforms);const e=gM(t),n=vM();this.sideAbsorb=new J(e,this.absorbMat),this.sideSurface=new J(e,this.surfaceMat),this.topAbsorb=new J(n,this.absorbMat),this.topSurface=new J(n,this.surfaceMat);for(const s of[this.sideAbsorb,this.sideSurface,this.topAbsorb,this.topSurface])s.frustumCulled=!1,s.raycast=()=>{};this.sideAbsorb.add(this.sideSurface,this.topAbsorb,this.topSurface),this.root.add(this.sideAbsorb),this.setRenderOrderBase(0),this.sideAbsorb.visible=!1}root=new fe;sideAbsorb;sideSurface;topAbsorb;topSurface;uniforms;absorbMat;surfaceMat;Lref;targetCount=1;targets=Array.from({length:De},()=>({topMl:0,k:new T,scat:new ie(1,1,1,0)}));curTopMl=new Array(De).fill(0);totalMlTarget=0;totalMl=0;mixing=!1;rippleBase=.004;boil=0;gasAgitation=0;stirRpm=0;vortexCur=0;sloshAmp=0;sloshPhase=0;sloshDir=new H(1,0);_fillY;apparent="#f4f8fb";setRenderOrderBase(t){this.sideAbsorb.renderOrder=t+2,this.topAbsorb.renderOrder=t+2,this.sideSurface.renderOrder=t+3,this.topSurface.renderOrder=t+3}get fillY(){return this._fillY}get volumeMl(){return this.totalMl}get surfaceRadius(){return this.uniforms.uR.value}setLayers(t,e,n){const s=Math.min(De,t.length),r=t.reduce((c,h)=>c+Math.max(0,h.volume_ml),0),o=r>0?e/r:1;let a=0,l=s!==this.targetCount;for(let c=0;c<s;c++){const h=t[c];a+=Math.max(0,h.volume_ml)*o;const u=this.targets[c];u.topMl=a;const d=$u(n,h.absorbance_per_cm,this.Lref),f=-Math.log(Math.max(d[0],.001))/this.Lref,g=-Math.log(Math.max(d[1],.001))/this.Lref,_=-Math.log(Math.max(d[2],.001))/this.Lref;this.kChange(u.k,f,g,_)&&(l=!0),u.k.set(f,g,_),u.scat.set(h.scatter_rgb[0],h.scatter_rgb[1],h.scatter_rgb[2],Math.max(0,h.scatter_per_cm))}s===0&&(this.targets[0].topMl=e,this.targets[0].k.set(0,0,0),this.targets[0].scat.set(1,1,1,0)),this.commitTargets(Math.max(1,s),e,l)}setSimple(t,e,n=.85){const s=new St(e),r=Math.max(0,Math.min(1,n)),o=-Math.log(Math.max(s.r,.02))/this.Lref*r,a=-Math.log(Math.max(s.g,.02))/this.Lref*r,l=-Math.log(Math.max(s.b,.02))/this.Lref*r,c=this.targets[0],h=this.kChange(c.k,o,a,l);c.k.set(o,a,l),c.scat.set(1,1,1,0),c.topMl=t,this.commitTargets(1,t,h)}kChange(t,e,n,s){const r=Math.max(Math.abs(t.x-e),Math.abs(t.y-n),Math.abs(t.z-s)),o=Math.max(t.x,t.y,t.z,e,n,s,.05);return r>.04&&r/o>.18}commitTargets(t,e,n){const s=this.uniforms,r=this.totalMl<=1e-6&&e>0;if(this.targetCount=t,this.totalMlTarget=Math.max(0,e),r){for(let o=0;o<De;o++)s.uKOld.value[o].copy(this.targets[o].k),s.uKNew.value[o].copy(this.targets[o].k),s.uScat.value[o].copy(this.targets[o].scat),this.curTopMl[o]=this.targets[o].topMl*0;s.uMix.value=1,this.mixing=!1}else if(n){const o=s.uMix.value;for(let a=0;a<De;a++)s.uKOld.value[a].lerp(s.uKNew.value[a],o),s.uKNew.value[a].copy(this.targets[a].k);s.uMix.value=0,this.mixing=!0}else for(let o=0;o<De;o++)s.uKNew.value[o].copy(this.targets[o].k),this.mixing||s.uKOld.value[o].copy(this.targets[o].k);s.uLayerCount.value=t,this.updateApparent()}updateApparent(){let t=0,e=-1,n=0;for(let h=0;h<this.targetCount;h++){const u=this.targets[h].topMl-n;n=this.targets[h].topMl,u>e&&(e=u,t=h)}const s=this.targets[t],r=this.Lref,o=1-Math.exp(-s.scat.w*r),a=Math.exp(-s.k.x*r)*(1-o)+s.scat.x*o,l=Math.exp(-s.k.y*r)*(1-o)+s.scat.y*o,c=Math.exp(-s.k.z*r)*(1-o)+s.scat.z*o;this.apparent=yM(a,l,c)}getApparentHex(){return this.apparent}setStirring(t){this.stirRpm=Math.max(0,t)}setBoil(t){this.boil=Math.max(0,Math.min(1,t))}setGasAgitation(t){this.gasAgitation=Math.max(0,Math.min(1,t))}impact(t,e,n,s){const r=this.uniforms.uImpact.value;s-r.z<.25&&r.w>n||r.set(t,e,s,Math.min(1.5,n))}slosh(t,e=Math.random()-.5,n=Math.random()-.5){this.sloshAmp=Math.min(.12,this.sloshAmp+t),this.sloshDir.set(e,n).normalize(),this.sloshPhase=0}tick(t,e,n){const s=this.uniforms,r=this.profile;s.uTime.value=e;const o=this.totalMlTarget-this.totalMl;this.totalMl+=o*Math.min(1,t*4),Math.abs(o)<.002&&(this.totalMl=this.totalMlTarget);const a=Js(r,this.totalMl);this._fillY=a,s.uFill.value=a;const l=this.totalMl>.02;this.sideAbsorb.visible=l;const c=this.totalMlTarget>1e-6?this.totalMl/this.totalMlTarget:0;for(let m=0;m<De;m++){const p=this.targets[m].topMl*c;this.curTopMl[m]+=(p-this.curTopMl[m])*Math.min(1,t*5),s.uLayerTop.value[m]=Js(r,this.curTopMl[m]),s.uScat.value[m].lerp(this.targets[m].scat,Math.min(1,t*2.5))}const h=Math.max(.05,xe(r,Math.min(a,r.innerTopY))),u=r.innerBottomY+Math.min(.6,(a-r.innerBottomY)*.3),d=xe(r,u);s.uR.value=h;const f=a-u;if(f>.3?(s.uConeB.value=(h-d)/f,s.uConeA.value=h-s.uConeB.value*a):(s.uConeB.value=0,s.uConeA.value=h),this.mixing&&(s.uMix.value=Math.min(1,s.uMix.value+t/.9),s.uMix.value>=1)){this.mixing=!1;for(let m=0;m<De;m++)s.uKOld.value[m].copy(s.uKNew.value[m])}yh.copy(n).invert(),xh.set(0,1,0).transformDirection(yh),s.uUpObj.value.lerp(xh,Math.min(1,t*10)).normalize();const g=this.rippleBase+this.boil*.11+this.gasAgitation*.05+Math.min(.03,this.stirRpm/3e4);s.uRipple.value+=(g-s.uRipple.value)*Math.min(1,t*3);const _=Math.min(h*.45,this.stirRpm/1e3*1.6*Math.min(1,h/2.5))*(a-r.innerBottomY>1?1:0);if(this.vortexCur+=(_-this.vortexCur)*Math.min(1,t*1.5),s.uVortex.value=this.vortexCur,this.sloshAmp>1e-4){this.sloshPhase+=t;const m=this.sloshAmp*Math.exp(-this.sloshPhase*2.2)*Math.cos(this.sloshPhase*12.5);s.uSlosh.value.set(this.sloshDir.x*m,this.sloshDir.y*m),this.sloshPhase>3&&(this.sloshAmp=0,s.uSlosh.value.set(0,0))}}dispose(){this.absorbMat.dispose(),this.surfaceMat.dispose()}}function fa(i,t,e,n,s,r=.12){const o=[new H(0,0)],a=Math.min(.6,i*.18);for(let c=0;c<=5;c++){const h=-Math.PI/2+c/5*(Math.PI/2);o.push(new H(i-a+Math.cos(h)*a,a+Math.sin(h)*a))}o.push(new H(i,t));for(let c=1;c<=8;c++){const h=c/8,u=Math.sin(h*Math.PI/2);o.push(new H(i+(e-i)*u,t+n*h))}const l=t+n;return o.push(new H(e,l+s-r*2)),o.push(new H(e+r,l+s-r)),o.push(new H(e+r*.6,l+s)),o.push(new H(e*.85,l+s)),o}const ds={liquid:{R:3.7,body:fa(3.7,11.2,1.3,2.4,1.6),fillY:10.2,neckR:1.3,neckTopY:11.2+2.4+1.6,capR:1.62,capH:2.1,labelY0:2.2,labelY1:7.45,height:11.2+2.4+1.6+1.6},jar:{R:3.4,body:fa(3.4,8.6,2.55,.9,1,.1),fillY:6.9,neckR:2.55,neckTopY:8.6+.9+1,capR:2.85,capH:1.9,labelY0:1.2,labelY1:6.1,height:8.6+.9+1+1.5},dropper:{R:2,body:fa(2,6,.8,1,.9,.08),fillY:5,neckR:.8,neckTopY:7+.9,capR:1.05,capH:1.4,labelY0:.9,labelY1:3.75,height:7+.9+3.6}},bh=new Map;function Fn(i,t){let e=bh.get(i);return e||(e=t(),bh.set(i,e)),e}const zs=new Map;function ri(i,t){let e=zs.get(i);return e||(e=t(),zs.set(i,e)),e}function Sh(i){return Fn("body_"+i,()=>new Ue(ds[i].body,48).translate(0,So,0))}function SM(i,t){return Fn(`content_${i}_${t?"s":"l"}`,()=>{const e=ds[i],n=.22,s=[];for(const r of e.body){if(r.y>e.fillY)break;s.push(new H(Math.max(0,r.x-n),Math.max(r.y,n)))}return s.push(new H(e.R-n,e.fillY)),s.push(new H(0,e.fillY+(t?.5:0))),new Ue(s,40).translate(0,So,0)})}function wh(i){return Fn("cap_"+i,()=>{const t=ds[i],e=new ne(t.capR,t.capR,t.capH,48,1),n=e.attributes.position;for(let s=0;s<n.count;s++){const r=n.getX(s),o=n.getZ(s);if(Math.hypot(r,o)<t.capR*.99)continue;const l=Math.atan2(o,r),c=1+.025*Math.sign(Math.sin(l*24));n.setX(s,r*c),n.setZ(s,o*c)}return e.computeVertexNormals(),e.translate(0,t.capH/2,0),e})}function wM(i){return Fn("label_"+i,()=>{const t=ds[i],e=1.9,n=new ne(t.R+.04,t.R+.04,t.labelY1-t.labelY0,48,1,!0,-e/2,e);return n.translate(0,(t.labelY0+t.labelY1)/2+So,0),n})}function EM(i){return Fn("proxy_"+i,()=>{const t=ds[i],e=new ne(t.R,t.R,t.height,10);return e.translate(0,t.height/2,0),e})}const Eh=()=>ri("cap",()=>new vt({color:1776670,roughness:.42,metalness:0}));let TM=null;function AM(){return TM??=[ao(!0,{tint:8011026,baseAlpha:.2,fresnelAlpha:.3,edgeTint:10115610,roughness:.05,envMapIntensity:1.4}),ao(!1,{tint:8011026,baseAlpha:.2,fresnelAlpha:.3,edgeTint:10115610,roughness:.05,envMapIntensity:1.4})]}const CM=()=>ri("capw",()=>new vt({color:15328988,roughness:.5,metalness:0})),RM=()=>ri("hdpe",()=>new sn({color:15855592,roughness:.55,metalness:0,sheen:.4,sheenRoughness:.6,sheenColor:new St(16777215)})),PM=()=>ri("bulb",()=>new vt({color:8003346,roughness:.6,metalness:0})),LM=()=>ri("pipette",()=>new sn({color:16777215,roughness:.03,transparent:!0,opacity:.25,envMapIntensity:2,depthWrite:!1})),IM=()=>ri("proxy",()=>new Sn({visible:!1}));function Th(i,t){const e=`c_${t?"s":"l"}_${i}`;if(zs.size>160)for(const[n,s]of zs)n.startsWith("c_")&&(s.dispose(),zs.delete(n));return ri(e,()=>{const n=new St(i);if(t)return new vt({color:n,roughness:.95,metalness:0});const r=n.r*.3+n.g*.59+n.b*.11>.85;return new sn({color:r?n.clone().multiply(new St(.8,.93,1)):n,roughness:.05,metalness:0,transparent:!0,opacity:r?.4:.8,depthWrite:!1,envMapIntensity:1.2})})}function Zu(i){return i?"#f4f3ef":"#f2f6f8"}function Ju(i,t=""){return/^(Mg|Zn|Al|Fe|Cu|Sn|Pb|Ni|Ca|Na|K|Li)$/.test(i.trim())||/ribbon|turnings|granules|wire|foil/i.test(t)}const DM={0:"₀",1:"₁",2:"₂",3:"₃",4:"₄",5:"₅",6:"₆",7:"₇",8:"₈",9:"₉"};function UM(i){return i.replace(/([A-Za-z\)\]])(\d+)/g,(t,e,n)=>e+n.split("").map(s=>DM[s]??s).join(""))}function Ah(i,t,e,n,s="700",r='"Helvetica Neue", Arial, sans-serif'){let o=n;for(i.font=`${s} ${o}px ${r}`;i.measureText(t).width>e&&o>12;)o-=2,i.font=`${s} ${o}px ${r}`;return o}function NM(i,t,e,n,s){i.save(),i.translate(t,e),i.save(),i.rotate(Math.PI/4);const r=n/Math.SQRT2;i.fillStyle="#ffffff",i.fillRect(-r/2,-r/2,r,r),i.strokeStyle="#d0191b",i.lineWidth=n*.08,i.strokeRect(-r/2+i.lineWidth/2,-r/2+i.lineWidth/2,r-i.lineWidth,r-i.lineWidth),i.restore(),i.fillStyle="#111",i.strokeStyle="#111";const o=n/10,a=(l,c,h)=>{i.beginPath(),i.moveTo(l,c+2.2*o*h),i.bezierCurveTo(l-2*o*h,c+1.6*o*h,l-1.6*o*h,c-.6*o*h,l-.2*o*h,c-2.4*o*h),i.bezierCurveTo(l,c-1*o*h,l+.9*o*h,c-1.2*o*h,l+.7*o*h,c-2*o*h),i.bezierCurveTo(l+2.2*o*h,c-.6*o*h,l+1.9*o*h,c+1.7*o*h,l,c+2.2*o*h),i.fill()};switch(s){case"GHS01":{i.beginPath(),i.arc(0,.8*o,1.3*o,0,Math.PI*2),i.fill(),i.lineWidth=o*.4;for(let l=0;l<8;l++){const c=l/8*Math.PI*2;i.beginPath(),i.moveTo(Math.cos(c)*1.8*o,.8*o+Math.sin(c)*1.8*o),i.lineTo(Math.cos(c)*2.8*o,.8*o+Math.sin(c)*2.8*o),i.stroke()}break}case"GHS02":a(0,0,1),i.fillRect(-2.2*o,2.4*o,4.4*o,.5*o);break;case"GHS03":i.lineWidth=o*.6,i.beginPath(),i.arc(0,1.4*o,1.3*o,0,Math.PI*2),i.stroke(),a(0,-.9*o,.75);break;case"GHS04":i.save(),i.rotate(-.5),i.beginPath(),i.roundRect(-3*o,-.9*o,6*o,1.8*o,.9*o),i.fill(),i.restore();break;case"GHS05":i.fillRect(-2.6*o,2*o,5.2*o,.6*o),i.beginPath(),i.moveTo(-2.2*o,-2.6*o),i.lineTo(-.9*o,-2.6*o),i.lineTo(-1.2*o,-.6*o),i.lineTo(-1.9*o,-.6*o),i.fill(),i.beginPath(),i.moveTo(.9*o,-2.6*o),i.lineTo(2.2*o,-2.6*o),i.lineTo(1.9*o,-.6*o),i.lineTo(1.2*o,-.6*o),i.fill(),i.beginPath(),i.arc(-1.55*o,.4*o,.4*o,0,Math.PI*2),i.fill(),i.beginPath(),i.arc(1.55*o,.4*o,.4*o,0,Math.PI*2),i.fill(),i.fillRect(.6*o,1*o,2.2*o,.9*o);break;case"GHS06":i.beginPath(),i.ellipse(0,-.9*o,1.6*o,1.5*o,0,0,Math.PI*2),i.fill(),i.fillStyle="#fff",i.beginPath(),i.arc(-.6*o,-1*o,.42*o,0,Math.PI*2),i.fill(),i.beginPath(),i.arc(.6*o,-1*o,.42*o,0,Math.PI*2),i.fill(),i.strokeStyle="#111",i.lineWidth=o*.55,i.beginPath(),i.moveTo(-2.2*o,.9*o),i.lineTo(2.2*o,2.6*o),i.stroke(),i.beginPath(),i.moveTo(2.2*o,.9*o),i.lineTo(-2.2*o,2.6*o),i.stroke();break;case"GHS07":i.font=`900 ${n*.55}px Arial`,i.textAlign="center",i.textBaseline="middle",i.fillText("!",0,o*.3);break;case"GHS08":i.beginPath(),i.arc(0,-2*o,.7*o,0,Math.PI*2),i.fill(),i.beginPath(),i.moveTo(-1.8*o,2.6*o),i.lineTo(-1.6*o,-.6*o),i.quadraticCurveTo(0,-1.4*o,1.6*o,-.6*o),i.lineTo(1.8*o,2.6*o),i.fill(),i.fillStyle="#fff";for(let l=0;l<8;l++){const c=l/8*Math.PI*2;i.beginPath(),i.moveTo(0,.6*o),i.lineTo(Math.cos(c)*1.1*o,.6*o+Math.sin(c)*1.1*o),i.lineTo(Math.cos(c+.4)*.4*o,.6*o+Math.sin(c+.4)*.4*o),i.fill()}break;case"GHS09":i.lineWidth=o*.45,i.beginPath(),i.moveTo(-1.6*o,.4*o),i.lineTo(-1.6*o,-2.4*o),i.stroke(),i.beginPath(),i.moveTo(-1.6*o,-1.4*o),i.lineTo(-2.6*o,-2.2*o),i.stroke(),i.beginPath(),i.moveTo(-1.6*o,-1*o),i.lineTo(-.5*o,-2*o),i.stroke(),i.beginPath(),i.ellipse(.9*o,1.6*o,1.4*o,.6*o,0,0,Math.PI*2),i.fill(),i.beginPath(),i.moveTo(2.2*o,1.6*o),i.lineTo(2.9*o,1*o),i.lineTo(2.9*o,2.2*o),i.fill(),i.fillRect(-2.8*o,2.6*o,5.6*o,.35*o);break;default:i.font=`700 ${n*.18}px Arial`,i.textAlign="center",i.textBaseline="middle",i.fillText(s,0,0)}i.restore()}function OM(i,t){const s=document.createElement("canvas");s.width=512,s.height=384;const r=s.getContext("2d");r.fillStyle="#fbfaf5",r.fillRect(0,0,512,384);const o=r.createLinearGradient(0,0,512,0);o.addColorStop(0,"rgba(0,0,0,0.06)"),o.addColorStop(.5,"rgba(0,0,0,0)"),o.addColorStop(1,"rgba(0,0,0,0.06)"),r.fillStyle=o,r.fillRect(0,0,512,384);const a=i.signal_word||"",l=a==="Danger"?"#c4161c":a==="Warning"?"#e06a00":"#1f5fa8";r.fillStyle=l,r.fillRect(0,0,512,54),r.fillStyle="#fff",r.font='700 26px "Helvetica Neue", Arial, sans-serif',r.textAlign="left",r.textBaseline="middle",r.fillText(a?a.toUpperCase():"LABORATORY REAGENT",22,28),r.textAlign="right",r.font="600 20px Arial, sans-serif";const c=i.form==="solid"||i.by_mass?"SOLID":i.form==="liquid"?"LIQUID":i.form==="solution"?"SOLUTION":"";r.fillText(c,490,28),r.textAlign="left",r.fillStyle="#16181b";const h=i.name||"Reagent",u=Ah(r,h,468,t==="dropper"?52:46);r.textBaseline="alphabetic",r.fillText(h,22,70+u);const d=UM(i.formula||"");let f=70+u+14;if(d){const v=Ah(r,d,468,42,"600",'"Times New Roman", Georgia, serif');r.fillStyle="#23384f",r.fillText(d,22,f+v),f+=v+10}if(i.concentration_m!==void 0&&i.concentration_m!==null&&i.concentration_m>0){const v=i.concentration_m,A=v>=1?`${v.toFixed(v%1===0?1:2)} M`:v>=.01?`${v.toFixed(2)} M`:`${(v*1e3).toFixed(1)} mM`;r.font='700 34px "Helvetica Neue", Arial, sans-serif',r.fillStyle="#16181b",r.fillText(A,22,f+34),f+=44}const g=(i.ghs||[]).slice(0,4),_=g.length>2?78:92;let m=490-_/2;const p=362-_/2-18;for(let v=g.length-1;v>=0;v--)NM(r,m,p,_,g[v]),m-=_*.92;r.fillStyle="rgba(30,30,30,0.6)",r.font="500 15px Arial, sans-serif",r.textAlign="left";let x=0;for(const v of i.id)x=x*31+v.charCodeAt(0)>>>0;r.fillText(`Lot ${x%9e4+1e4} · Store tightly closed`,22,366),r.strokeStyle="rgba(0,0,0,0.25)",r.lineWidth=3,r.strokeRect(1.5,1.5,509,381);const M=new vo(s);return M.colorSpace=we,M.anisotropy=4,M}function Qu(i){return i.dropper?"dropper":i.form==="solid"||i.by_mass?"jar":"liquid"}function td(){const i=new fe,t=new J(Fn("pipette_tube",()=>{const n=[new H(.06,0),new H(.12,.4),new H(.26,2.4),new H(.28,7.4),new H(.34,7.6)];return new Ue(n,16)}),LM());t.renderOrder=950;const e=new J(Fn("pipette_bulb",()=>{const n=[new H(.42,0)];for(let s=0;s<=10;s++){const r=s/10;n.push(new H(.42+Math.sin(r*Math.PI)*.38*(r<.7?1:1-(r-.7)*2.5),.2+r*2.4))}return n.push(new H(0,2.7)),new Ue(n,20)}),PM());return e.position.y=7.4,e.name="bulb",e.castShadow=!0,i.add(t,e),i}function FM(){const i=new fe,t=ri("steel",()=>new vt({color:14277855,metalness:1,roughness:.22})),e=new J(Fn("spat_blade",()=>{const s=new us;s.moveTo(-.5,0),s.quadraticCurveTo(-.6,.65,0,.7),s.lineTo(3.2,.25),s.lineTo(3.2,-.25),s.lineTo(0,-.7),s.quadraticCurveTo(-.6,-.65,-.5,0);const r=new Ci(s,{depth:.05,bevelEnabled:!1});return r.rotateX(-Math.PI/2),r}),t),n=new J(Fn("spat_handle",()=>{const s=new ne(.18,.18,12,12);return s.rotateZ(Math.PI/2),s.translate(9.2,.05,0),s}),t);return e.castShadow=!0,n.castShadow=!0,i.add(e,n),i}function ed(i){const t=Qu(i),e=ds[t],n=t==="jar",s=new fe;s.name=`bottle_${i.id}`;const r=i.bottle_colour??"clear",o=i.colorHex&&i.colorHex!==""?i.colorHex:Zu(n);let a=null,l;const c=r==="white"&&t!=="jar";if(c)l=new J(Sh(t),RM()),l.castShadow=!0,l.receiveShadow=!0;else{const M=Qs(Sh(t),r==="amber"?AM():Xu());l=M.near,a=M.far}l.raycast=()=>{},a&&(a.raycast=()=>{}),s.add(l);let h=null;c||(h=new J(SM(t,n),Th(o,n)),h.raycast=()=>{},s.add(h));const u=OM(i,t),d=new vt({map:u,roughness:.75,metalness:0,transparent:!0,emissive:16777215,emissiveIntensity:0,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),f=new J(wM(t),d);f.raycast=()=>{},f.receiveShadow=!0,s.add(f);let g,_=null;if(t==="dropper"){const M=new fe,v=new J(wh(t),Eh());v.position.y=e.neckTopY-.6,v.castShadow=!0;const A=td();A.position.y=.9,A.scale.setScalar(1);const E=A.getObjectByName("bulb");E.position.y=e.neckTopY-.6+e.capH-.9-.2,M.add(v,A),s.add(M),g=M,_=M}else{const M=new J(wh(t),r==="white"?CM():Eh());M.position.y=e.neckTopY-.9,M.castShadow=!0,M.raycast=()=>{},s.add(M),g=M}g.traverse(M=>M.raycast=()=>{});const m=new J(EM(t),IM());m.visible=!1,m.userData.pick={type:"bottle",id:i.id},s.add(m),s.userData.pick={type:"bottle",id:i.id};const p=new T(e.neckR+.1,e.neckTopY,0),x={group:s,kind:t,cap:g,dropperParts:_,pickProxy:m,height:e.height,radius:e.R,lipLocal:p,contentHex:o,setContentColor:M=>{x.contentHex=M,h&&(h.material=Th(M,n))},setRenderOrderBase:M=>{l.renderOrder=M+5,a&&(a.renderOrder=M+1),h&&(h.renderOrder=M+2),f.renderOrder=M+6},setHover:M=>{d.emissiveIntensity=M?.14:0},dispose:()=>{u.dispose(),d.dispose(),s.parent?.remove(s)}};return x}function BM(i){return{id:i.id,name:i.name,formula:i.formula,concentration_m:i.form==="solution"?i.concentration_m:void 0,ghs:i.ghs,signal_word:i.signal_word,bottle_colour:i.bottle_colour,form:i.form,dropper:i.dropper,by_mass:i.by_mass}}let nd=null;function kM(i){nd=i}const Ch=new Map,kr=new Map;let zr=null,Hr=null,pa=null,ma=null,Vr=null,ga=null,Rh=new Map;function Ph(){return Vr||(Vr=new ze(1,1),Vr.rotateX(-Math.PI/2)),Vr}function zM(i){let t=Ch.get(i.type);if(t)return t;if(t=new Ue(i.shell,96),i.spout>0){const e=t.attributes.position,n=.9+i.rimInnerRadius*.12,s=i.rimY-n;for(let r=0;r<e.count;r++){const o=e.getY(r);if(o<=s)continue;const a=e.getX(r),l=e.getZ(r),c=Math.atan2(l,a),h=Math.exp(-Math.pow(c/.3,2));if(h<.001)continue;const u=Math.pow((o-s)/n,2.2),d=Math.hypot(a,l),f=d+i.spout*h*u;e.setXYZ(r,a/d*f,o-.12*h*u,l/d*f)}t.computeBoundingSphere()}return Ch.set(i.type,t),t}function HM(i){if(kr.has(i.type))return kr.get(i.type);if(!i.graduations.length)return kr.set(i.type,null),null;const t=i.innerBottomY,e=Js(i,i.nominalMl),n=Math.min(i.rimY-.4,e+(i.type==="cylinder-100"?1.2:1.8)),s=[],r=40;for(let d=0;d<=r;d++){const f=t+(n-t)*d/r;s.push(new H(Bs(i,f)+.012,f))}const o=Bs(i,(t+n)/2),a=Math.max(.4,Math.min(1.3,2.5/o)),l=new Ue(s,16,-a/2,a),c=i.graduations.map(d=>({v:(Js(i,d.ml)-t)/(n-t),major:d.major,label:d.label})),h=Q_(i.type,c,i.gradTitle,i.type==="cylinder-100"),u={geo:l,tex:h};return kr.set(i.type,u),u}function VM(){if(Hr)return{geos:Hr,mat:pa};const i=12,t=5.5,e=new qe(i,1.2,t);e.translate(0,.6,0);const n=new us;n.moveTo(-i/2,-t/2),n.lineTo(i/2,-t/2),n.lineTo(i/2,t/2),n.lineTo(-i/2,t/2),n.lineTo(-i/2,-t/2);for(const a of[-3.8,0,3.8]){const l=new oo;l.absarc(a,0,1.42,0,Math.PI*2,!0),n.holes.push(l)}const s=new Ci(n,{depth:.7,bevelEnabled:!0,bevelThickness:.08,bevelSize:.08,bevelSegments:1,curveSegments:24});s.rotateX(Math.PI/2),s.translate(0,8.2,0);const r=new qe(.8,7.4,t*.8);r.translate(0,1.2+3.7,0),Hr={base:e,plate:s,post:r};const o=qu().clone();return o.needsUpdate=!0,o.repeat.set(.15,1),pa=new vt({map:o,roughness:.55,metalness:0,color:14206896}),{geos:Hr,mat:pa}}function GM(){return ma||(ma=new Sn({map:G_(),color:0,transparent:!0,opacity:.5,depthWrite:!1,polygonOffset:!0,polygonOffsetFactor:-4})),ma}function WM(){return ga||(ga=new Sn({visible:!1})),ga}function qM(i,t){let e=Rh.get(i);return e||(e=new vt({map:t,color:16777215,roughness:.45,metalness:0,transparent:!0,depthWrite:!1,polygonOffset:!0,polygonOffsetFactor:-2}),Rh.set(i,e)),e}function YM(i){const t=D_(i.type),e=new fe;e.name=`vessel_${i.id}`,e.userData.pick={type:"vessel",id:i.id};const n=new fe;n.position.y=t.baseOffsetY,e.add(n);const{near:s,far:r}=Qs(zM(t));s.raycast=()=>{},r.raycast=()=>{},n.add(s);const o=[];if(t.footHeight>0){zr||(zr=new ne(t.footRadius,t.footRadius*1.02,t.footHeight,6,1),zr.translate(0,t.footHeight/2,0));const U=Qs(zr);U.near.raycast=()=>{},U.far.raycast=()=>{},n.add(U.near),o.push(U.near)}let a=null;const l=HM(t);l&&(a=new J(l.geo,qM(t.type,l.tex)),a.raycast=()=>{},n.add(a));const c=new fe;if(e.add(c),t.rack){const{geos:U,mat:O}=VM(),V=new J(U.base,O),G=new J(U.plate,O),D=new J(U.post,O),N=new J(U.post,O);D.position.x=-5.6,N.position.x=5.6;for(const j of[V,G,D,N])j.castShadow=!0,j.receiveShadow=!0,j.raycast=()=>{},c.add(j)}const h=new bM(t);n.add(h.root);const u=h.sideAbsorb,d=new dM(t,h);n.add(d.group);const f=N_(t),g=U_(t),_=new J(Ph(),GM()),m=t.rack?15:f*2.6;_.scale.set(m,1,t.rack?9:m),_.position.y=.04,_.renderOrder=0,_.raycast=()=>{},e.add(_);const p=new Sn({map:V_(),color:8177919,transparent:!0,opacity:0,depthWrite:!1,blending:Ws,polygonOffset:!0,polygonOffsetFactor:-6}),x=new J(Ph(),p),M=f*2*1.75;x.scale.set(M,1,M),x.position.y=.06,x.visible=!1,x.raycast=()=>{},e.add(x);const v=new ne(f,f,g+1,12);v.translate(0,(g+1)/2,0);const A=new J(v,WM());A.visible=!1,A.userData.pick={type:"vessel",id:i.id},e.add(A);let E=!1,R=!1,P=0,b=0,y=!1,I=0;const F={group:e,glassMesh:s,liquidMesh:u,vesselState:i,effects:d,profile:t,glassRoot:n,liquid:h,pickProxy:A,lastSnapshot:null,height:g,footprint:f,updateLiquid:(U,O,V=.85)=>{i.currentVolumeMl=U,i.liquidColor=O,h.setSimple(U,O,V)},applyVisual:(U,O,V)=>{F.lastSnapshot=U,i.currentVolumeMl=U.total_liquid_ml,i.temperatureK=U.temperature_k,U.ph!==null&&U.ph!==void 0&&(i.ph=U.ph),h.setLayers(U.layers||[],U.total_liquid_ml,V??nd),i.liquidColor=h.getApparentHex(),d.applySnapshot(U)},setStirring:U=>{d.setStirring(U),i.stirring=U>0},setSelected:U=>{E=U},getLiquidColorHex:()=>h.getApparentHex(),tick:(U,O)=>{F.lastSnapshot||d.setSealed(i.isSealed),h.tick(U,O,n.matrixWorld),d.tick(U,O),P+=((E?.85:R?.35:0)-P)*Math.min(1,U*8),p.opacity=P*(E?.85+.15*Math.sin(O*2.5):1),x.visible=P>.01;const G=Math.max(0,e.position.y-b);_.position.y=b-e.position.y+.04,x.position.y=b-e.position.y+.06;const D=Math.max(0,1-G/25);_.visible=D>.02&&!y,_.scale.set(m*(1+G*.04),1,(t.rack?9:m)*(1+G*.04))},setHover:U=>{R=U},setRenderOrderBase:U=>{if(U!==I){I=U,s.renderOrder=U+5,r.renderOrder=U+1;for(const O of o)O.renderOrder=U+5,O.children[0].renderOrder=U+1;a&&(a.renderOrder=U+6),h.setRenderOrderBase(U),d.setRenderOrderBase(U),x.renderOrder=U,_.renderOrder=U}},setGroundY:U=>{b=U},lipLocal:()=>{const U=t.rimOuterRadius+t.spout*.9;return new T(U,t.rimY+t.baseOffsetY-(t.spout>0?.12:0),0)},probeLocal:(U,O)=>{const V=U==="thermo"?-.75:-2.35,G=new T(Math.cos(V),0,Math.sin(V)),D=t.innerBottomY+.45+O,N=Math.max(0,xe(t,D+.6)-O-.2),j=Math.max(0,t.rimInnerRadius-O-.12),it=G.clone().multiplyScalar(N);it.y=D+t.baseOffsetY;const ut=G.clone().multiplyScalar(j-N);return ut.y=t.rimY-D,ut.normalize(),{tip:it,up:ut}},stopperTopLocal:()=>d.stopperTopY()+t.baseOffsetY,surfaceLocalY:()=>h.fillY+t.baseOffsetY,isBurst:()=>y,setRackVisible:U=>{c.visible=U},dispose:()=>{h.dispose(),d.dispose(),p.dispose(),v.dispose(),e.parent?.remove(e)}};return d.onBurst=()=>{y=!0,s.visible=!1;for(const U of o)U.visible=!1;a&&(a.visible=!1),h.root.visible=!1},F.setRenderOrderBase(10),h.setSimple(i.currentVolumeMl,i.liquidColor||"#f4f8fb",0),F}const yl=.34,Gr=2.6,va=26;class XM{group=new fe;liquidColumn;attachedBundle=null;displayedTempK=295.15;tauSeconds=4;constructor(){this.group.name="instrument_thermometer";const t=yl,e=[new H(0,0)];for(let h=0;h<=6;h++){const u=-Math.PI/2+h/6*(Math.PI/2);e.push(new H(Math.cos(u)*.36,.36+Math.sin(u)*.36))}e.push(new H(.36,1.6)),e.push(new H(t*.85,2)),e.push(new H(t,2.3)),e.push(new H(t,27.6));for(let h=1;h<=6;h++){const u=h/6*(Math.PI/2);e.push(new H(Math.cos(u)*t,27.6+Math.sin(u)*t))}const n=new Ue(e,24),{near:s}=Qs(n);s.raycast=()=>{},s.traverse(h=>h.raycast=()=>{}),this.group.add(s);const r=new vt({color:13112861,roughness:.3,emissive:3801088}),o=new J(new Mo(.24,1.1,6,16),r);o.position.y=.95,this.group.add(o);const a=new ne(.055,.055,1,8);a.translate(0,.5,0),this.liquidColumn=new J(a,r),this.liquidColumn.position.set(0,1.5,.07),this.group.add(this.liquidColumn);const l=new J(new ze(.42,va-Gr+1.2),new vt({map:tM(),roughness:.5}));l.position.set(0,(Gr+va)/2,-.06),this.group.add(l);const c=new J(new bo(.25,.06,6,16),new vt({color:12106946,metalness:1,roughness:.3}));c.position.y=28.15,this.group.add(c),this.group.traverse(h=>{h.raycast=()=>{},h.isMesh&&h!==s&&(h.castShadow=!0)}),this.update(null,0)}attachTo(t){this.attachedBundle=t}getAttached(){return this.attachedBundle}update(t,e){const n=t?t.temperature_k:this.displayedTempK,s=Math.min(1,e/this.tauSeconds);this.displayedTempK+=(n-this.displayedTempK)*s;const r=this.displayedTempK-273.15,o=Math.max(-25,Math.min(112,r)),a=Gr+(o+20)/130*(va-Gr);this.liquidColumn.scale.set(1,Math.max(.05,a-1.5),1)}readout(){const t=Math.round(this.displayedTempK*10)/10,e=Math.round((t-273.15)*10)/10;return{temperature_k:t,temperature_c:e,formatted:`${e.toFixed(1)} °C`}}}class id{constructor(t,e,n={bg:"#aebd98",fg:"#18210f",ghost:"rgba(24,33,15,0.07)"}){this.opts=n,this.canvas=document.createElement("canvas"),this.canvas.width=512,this.canvas.height=Math.round(512*e/t),this.ctx=this.canvas.getContext("2d"),this.texture=new vo(this.canvas),this.texture.colorSpace=we,this.texture.anisotropy=4;const s=new Sn({map:this.texture,toneMapped:!1});this.mesh=new J(new ze(t,e),s),this.mesh.raycast=()=>{}}mesh;canvas;ctx;texture;last="";set(t,e=""){const n=t+"|"+e;if(n===this.last)return;this.last=n;const{ctx:s,canvas:r}=this,o=r.width,a=r.height,l=s.createLinearGradient(0,0,0,a);l.addColorStop(0,this.opts.bg),l.addColorStop(1,$M(this.opts.bg,-18)),s.fillStyle=l,s.fillRect(0,0,o,a);const c=Math.round(a*.62);s.font=`700 ${c}px "DSEG7 Classic", "Courier New", monospace`,s.textAlign="right",s.textBaseline="middle";const h=o-(this.opts.unit?o*.2:o*.06);s.fillStyle=this.opts.ghost,s.fillText("8888.88".slice(-Math.max(4,t.length)),h,a*.56),s.fillStyle=this.opts.fg,s.fillText(t,h,a*.56),this.opts.unit&&(s.textAlign="left",s.font=`700 ${Math.round(a*.26)}px Arial, sans-serif`,s.fillText(this.opts.unit,h+o*.03,a*.66)),(this.opts.caption||e)&&(s.textAlign="left",s.font=`600 ${Math.round(a*.16)}px Arial, sans-serif`,s.fillText(e||this.opts.caption||"",o*.04,a*.16));const u=s.createLinearGradient(0,0,o,a);u.addColorStop(0,"rgba(255,255,255,0.18)"),u.addColorStop(.4,"rgba(255,255,255,0.0)"),s.fillStyle=u,s.fillRect(0,0,o,a),this.texture.needsUpdate=!0}}function $M(i,t){const e=new St(i),n=s=>Math.max(0,Math.min(255,Math.round(s*255+t)));return`rgb(${n(e.r)},${n(e.g)},${n(e.b)})`}function yn(i,t,e,n){const s=new us,r=-i/2,o=-e/2;s.moveTo(r+n,o),s.lineTo(r+i-n,o),s.quadraticCurveTo(r+i,o,r+i,o+n),s.lineTo(r+i,o+e-n),s.quadraticCurveTo(r+i,o+e,r+i-n,o+e),s.lineTo(r+n,o+e),s.quadraticCurveTo(r,o+e,r,o+e-n),s.lineTo(r,o+n),s.quadraticCurveTo(r,o,r+n,o);const a=Math.min(n*.5,t*.2),l=new Ci(s,{depth:t-a*2,bevelEnabled:!0,bevelThickness:a,bevelSize:a,bevelSegments:3,curveSegments:6});return l.rotateX(-Math.PI/2),l.translate(0,a,0),l}function jM(i,t,e){const n=i.parent;if(!n){i.position.copy(t),i.quaternion.copy(e);return}n.updateWorldMatrix(!0,!1);const s=new Jt().copy(n.matrixWorld).invert(),r=new Jt().compose(t,e,new T(1,1,1));r.premultiply(s);const o=new T;r.decompose(i.position,i.quaternion,o)}const Jn=.6;class Hl{group=new fe;probe=new fe;lcd;displayedPh=null;tauSeconds=3;immersed=!0;cable;cableMat;lastCableKey="";socketLocal=new T(0,5.2,-8.4);constructor(){this.group.name="instrument_ph_meter";const t=new vt({color:15198694,roughness:.45,metalness:0}),e=new vt({color:2896182,roughness:.5,metalness:0}),n=new J(yn(16,4.5,18,1.2),t);n.castShadow=!0,n.receiveShadow=!0,this.group.add(n);const s=new J(yn(14.5,1,11,.8),e);s.position.set(0,4.3,.8),s.rotation.x=.32,s.castShadow=!0,this.group.add(s),this.lcd=new id(9.5,4.2,{bg:"#b4c39c",fg:"#151d0e",ghost:"rgba(21,29,14,0.08)",unit:"pH",caption:"ATC  25.0°C"}),this.lcd.mesh.position.set(0,5.84,-.6),this.lcd.mesh.rotation.x=-Math.PI/2+.32,this.group.add(this.lcd.mesh);const r=yn(2.4,.5,1.3,.3),o=new vt({color:9082012,roughness:.6});for(let l=0;l<3;l++){const c=new J(r,l===2?new vt({color:3046706,roughness:.5}):o);c.position.set(-3.3+l*3.3,4.2,4.2),c.rotation.x=.32,this.group.add(c)}const a=new J(new ne(.6,.6,1.2,16),new vt({color:12633288,metalness:1,roughness:.3}));a.rotation.x=Math.PI/2,a.position.set(0,2.6,-9.2),this.group.add(a),this.socketLocal.set(0,2.6,-9.6),this.buildProbe(),this.group.add(this.probe),this.cableMat=new vt({color:1776928,roughness:.55}),this.cable=new J(new pe,this.cableMat),this.cable.castShadow=!0,this.group.add(this.cable),this.group.traverse(l=>l.raycast=()=>{}),this.lcd.set("---")}buildProbe(){const t=[new H(0,0),new H(.28,.06),new H(.42,.3),new H(.45,.55),new H(.38,.9),new H(.5,1.1),new H(.5,2.2)],{near:e}=Qs(new Ue(t,20));this.probe.add(e);const n=new J(new ne(.3,.3,1.6,12),new vt({color:14279914,roughness:.2,transparent:!0,opacity:.6}));n.position.y=1.4,this.probe.add(n);const s=new vt({color:2303787,roughness:.35,metalness:0}),r=new J(new ne(Jn,Jn,11.5,20),s);r.position.y=2.1+5.75,r.castShadow=!0,this.probe.add(r);const o=new J(new ne(Jn+.02,Jn+.02,1,20,1,!0),new vt({color:3817800,roughness:.4}));o.position.y=2.4,this.probe.add(o);const a=new J(new ne(.42,Jn,1.6,16),new vt({color:1402304,roughness:.45}));a.position.y=2.1+11.5+.8,this.probe.add(a);const l=new J(new ne(.18,.3,1.6,10),s);l.position.y=2.1+11.5+2.4,this.probe.add(l)}static PROBE_LENGTH=17;setProbeWorldPose(t,e){jM(this.probe,t,e),this.updateCable()}updateCable(){this.group.updateWorldMatrix(!0,!1);const t=new T(0,Hl.PROBE_LENGTH-.2,0).applyQuaternion(this.probe.quaternion).add(this.probe.position),e=`${t.x.toFixed(2)},${t.y.toFixed(2)},${t.z.toFixed(2)}`;if(e===this.lastCableKey)return;this.lastCableKey=e;const n=this.socketLocal.clone(),s=new T(0,1,0).applyQuaternion(this.probe.quaternion),r=t.clone().addScaledVector(s,4),o=t.clone().lerp(n,.5),a=t.distanceTo(n);o.y=Math.max(.6,Math.min(t.y,n.y)-a*.25);const l=n.clone().add(new T(0,0,-3));l.y=1;const c=new _o([t,r,o,l,n]),h=new sr(c,48,.22,8,!1);this.cable.geometry.dispose(),this.cable.geometry=h}attachTo(t){}setImmersed(t){this.immersed=t}update(t,e){if(!(!!t&&this.immersed&&t.total_liquid_ml>.1&&t.ph!==null&&!t.burst)){this.displayedPh=null,this.lcd.set("---");return}const s=t.ph;if(this.displayedPh===null)this.displayedPh=7+(s-7)*.35;else{const a=Math.min(1,e/this.tauSeconds);this.displayedPh+=(s-this.displayedPh)*a}const r=Math.round(this.displayedPh*100)/100,o=t.temperature_k-273.15;this.lcd.set(r.toFixed(2),`ATC  ${o.toFixed(1)}°C`)}readout(){if(this.displayedPh===null)return{ph:null,formatted:"---"};const t=Math.round(this.displayedPh*100)/100;return{ph:t,formatted:t.toFixed(2)}}}class KM{group=new fe;lcd;displayedMassG=0;tareOffsetG=0;attachedGlassMassG=0;attached=!1;tauSeconds=.8;constructor(){this.group.name="instrument_balance";const t=new J(yn(20,6.5,27,1.5),new vt({color:15527660,roughness:.42,metalness:0}));t.castShadow=!0,t.receiveShadow=!0,this.group.add(t);const e=new vt({color:14804199,metalness:1,roughness:.18}),n=new J(new ne(6.5,6.4,.35,48),e);n.position.set(0,6.85,-3),n.castShadow=!0,n.receiveShadow=!0,this.group.add(n);const s=new J(new ne(1.2,1.5,.4,16),e);s.position.set(0,6.6,-3),this.group.add(s);const r=new J(yn(14,.6,5.5,.6),new vt({color:2830389,roughness:.5}));r.position.set(0,6.3,10.2),r.rotation.x=.25,this.group.add(r),this.lcd=new id(8.5,2.6,{bg:"#0f1a14",fg:"#a8f7c0",ghost:"rgba(168,247,192,0.06)",unit:"g"}),this.lcd.mesh.position.set(-1.6,6.95,10.1),this.lcd.mesh.rotation.x=-Math.PI/2+.25,this.group.add(this.lcd.mesh);const o=new vt({color:6253428,roughness:.6});for(let l=0;l<2;l++){const c=new J(yn(1.6,.35,1.1,.25),o);c.position.set(4.3+l*1.9,6.85,10.4),c.rotation.x=.25,this.group.add(c)}const a=new vt({color:546,roughness:.8});for(const[l,c]of[[-8.5,-11.5],[8.5,-11.5],[-8.5,11.5],[8.5,11.5]]){const h=new J(new ne(.7,.8,.4,12),a);h.position.set(l,-.1,c),this.group.add(h)}this.group.traverse(l=>l.raycast=()=>{}),this.renderScreen(0)}attachTo(t){if(this.attached=!!t,t)switch(t.vesselState.type){case"beaker-50":this.attachedGlassMassG=35;break;case"beaker-250":this.attachedGlassMassG=110;break;case"beaker-1000":this.attachedGlassMassG=320;break;case"erlenmeyer-250":this.attachedGlassMassG=130;break;case"cylinder-100":this.attachedGlassMassG=145;break;case"test-tube":this.attachedGlassMassG=18;break;default:this.attachedGlassMassG=60;break}else this.attachedGlassMassG=0}tare(){this.tareOffsetG+=this.displayedMassG}update(t,e){const s=(t&&this.attached&&!t.burst?this.attachedGlassMassG+t.contents_mass_g:0)-this.tareOffsetG,r=Math.min(1,e/this.tauSeconds);this.displayedMassG+=(s-this.displayedMassG)*r,this.renderScreen(Math.round(this.displayedMassG*100)/100)}renderScreen(t){this.lcd.set(t.toFixed(2))}readout(){const t=Math.round(this.displayedMassG*100)/100;return{mass_g:t,formatted:`${t.toFixed(2)} g`}}}class ZM{group=new fe;needle;dial=new fe;displayedPressureAtm=1;tauSeconds=.5;attached=!1;constructor(){this.group.name="instrument_pressure_gauge";const t=new vt({color:13215050,metalness:1,roughness:.28}),e=new J(new ne(.22,.22,3.2,12),t);e.position.y=1.6,this.group.add(e);const n=new J(new ne(.55,.55,.7,6),t);n.position.y=3.2,this.group.add(n),this.dial.position.y=3.2+2.9,this.group.add(this.dial);const s=new vt({color:13949148,metalness:1,roughness:.25}),r=new J(new ne(2.9,2.9,1.3,40),s);r.rotation.x=Math.PI/2,this.dial.add(r);const o=new J(new bo(2.85,.18,10,40),s);o.position.z=.66,this.dial.add(o);const a=document.createElement("canvas");a.width=512,a.height=512;const l=a.getContext("2d");l.fillStyle="#fbfbf8",l.beginPath(),l.arc(256,256,250,0,Math.PI*2),l.fill();const c=Math.PI*.75,h=Math.PI*1.5;l.strokeStyle="#d32f2f",l.lineWidth=22,l.beginPath(),l.arc(256,256,200,c+2/3*h,c+h),l.stroke(),l.strokeStyle="#1b1b1b",l.fillStyle="#1b1b1b";for(let m=0;m<=3.0001;m+=.1){const p=c+m/3*h,x=Math.abs(m*2-Math.round(m*2))<.001;l.lineWidth=x?6:3,l.beginPath(),l.moveTo(256+Math.cos(p)*220,256+Math.sin(p)*220),l.lineTo(256+Math.cos(p)*(x?180:200),256+Math.sin(p)*(x?180:200)),l.stroke(),x&&(l.font="bold 40px Arial",l.textAlign="center",l.textBaseline="middle",l.fillText(m.toFixed(1),256+Math.cos(p)*145,256+Math.sin(p)*145))}l.font="600 34px Arial",l.textAlign="center",l.fillText("atm",256,340),l.font="500 22px Arial",l.fillText("GAUGE",256,372);const u=new vo(a);u.colorSpace=we,u.anisotropy=4;const d=new J(new $s(2.7,48),new vt({map:u,roughness:.6}));d.position.z=.66,this.dial.add(d);const f=new qe(.1,2.3,.05);f.translate(0,.85,0),this.needle=new J(f,new vt({color:12000284,roughness:.4})),this.needle.position.z=.72,this.dial.add(this.needle);const g=new J(new ne(.22,.22,.15,12),new vt({color:546,metalness:.5}));g.rotation.x=Math.PI/2,g.position.z=.75,this.dial.add(g);const _=new J(new $s(2.75,40),new sn({color:16777215,transparent:!0,opacity:.08,roughness:.02,envMapIntensity:2,depthWrite:!1}));_.position.z=.8,this.dial.add(_),this.group.traverse(m=>{m.raycast=()=>{},m.isMesh&&(m.castShadow=!0)}),this.group.visible=!1,this.setNeedle(0)}faceToward(t){const e=new T;this.group.getWorldPosition(e),this.dial.rotation.y=Math.atan2(t.x-e.x,t.z-e.z)}attachTo(t){this.attached=!!t,t||(this.group.visible=!1)}setNeedle(t){const e=Math.max(0,Math.min(3,t))/3,n=Math.PI*.75+e*Math.PI*1.5;this.needle.rotation.z=-n-Math.PI/2}update(t,e){if(!t)return;if(!this.attached||!t.sealed||t.burst){this.group.visible=!1,this.displayedPressureAtm+=(1-this.displayedPressureAtm)*Math.min(1,e/this.tauSeconds);return}this.group.visible=!0;const n=Math.min(1,e/this.tauSeconds);this.displayedPressureAtm+=(t.pressure_atm-this.displayedPressureAtm)*n,this.setNeedle(this.displayedPressureAtm-1)}readout(){const t=Math.round(this.displayedPressureAtm*100)/100,e=Math.max(0,Math.round((t-1)*100)/100);return{pressure_atm:t,gauge_atm:e,formatted:`${e.toFixed(2)} atm (g)`}}}const Hs=10;class JM{group=new fe;topLocal=new T(0,Hs,-2);ceramicTop;topMat;heaterKnob;stirKnob;heatLed;stirLed;glow=0;heaterWatts=0;isStirring=!1;stirRpm=0;constructor(){this.group.name="equipment_hotplate";const t=new vt({color:15330280,roughness:.4,metalness:0}),e=new J(yn(19,9.4,24,1.4),t);e.castShadow=!0,e.receiveShadow=!0,this.group.add(e);const n=new vt({color:12172995,metalness:1,roughness:.35}),s=new J(yn(19,.4,19.4,1),n);s.position.set(0,9.3,-2),s.castShadow=!0,this.group.add(s),this.topMat=new vt({map:J_(),roughness:.18,metalness:0,emissive:new St(1,.28,.06),emissiveMap:Z_(),emissiveIntensity:0}),this.ceramicTop=new J(yn(18,.32,18,.8),this.topMat),this.ceramicTop.position.set(0,Hs-.32,-2),this.ceramicTop.receiveShadow=!0,this.group.add(this.ceramicTop);const r=new J(yn(17,.3,3.6,.4),new vt({color:3225405,roughness:.55}));r.position.set(0,9.38,9.6),this.group.add(r),this.heaterKnob=this.makeKnob(14172949),this.heaterKnob.position.set(-4.5,9.7,9.6),this.stirKnob=this.makeKnob(2001125),this.stirKnob.position.set(4.5,9.7,9.6),this.group.add(this.heaterKnob,this.stirKnob),this.heatLed=new vt({color:4194304,emissive:16722448,emissiveIntensity:0}),this.stirLed=new vt({color:10752,emissive:3211104,emissiveIntensity:0});const o=new ir(.22,10,8),a=new J(o,this.heatLed);a.position.set(-1.2,9.6,9.6);const l=new J(o,this.stirLed);l.position.set(1.2,9.6,9.6),this.group.add(a,l);const c=new vt({color:1907997,roughness:.9});for(const[h,u]of[[-8,-10],[8,-10],[-8,10],[8,10]]){const d=new J(new ne(.9,1,.5,12),c);d.position.set(h,-.15,u),this.group.add(d)}this.group.traverse(h=>h.raycast=()=>{})}makeKnob(t){const e=new fe,n=new J(new ne(1.25,1.35,1.2,28),new vt({color:2040358,roughness:.35}));n.position.y=.6,n.castShadow=!0;const s=new J(new qe(.22,.1,.9),new vt({color:t,roughness:.4}));return s.position.set(0,1.22,-.6),e.add(n,s),e}attachTo(t){if(t){const e=this.topLocal.clone();this.group.localToWorld(e),t.group.position.copy(e)}}setPower(t){this.heaterWatts=Math.max(0,Math.min(1e3,t)),this.heaterKnob.rotation.y=-(this.heaterWatts/1e3)*Math.PI*1.5,this.heatLed.emissiveIntensity=this.heaterWatts>0?2.5:0}setStir(t,e=400){this.isStirring=t,this.stirRpm=t?e:0,this.stirKnob.rotation.y=t?-(e/1500)*Math.PI*1.5:0,this.stirLed.emissiveIntensity=t?2:0}getControls(){return{heater_w:this.heaterWatts,stirring:this.isStirring,stir_rpm:this.stirRpm}}update(t,e){}animate(t){const e=this.heaterWatts/1e3;this.glow+=(e-this.glow)*Math.min(1,t/4),this.topMat.emissiveIntensity=Math.pow(this.glow,.8)*2.4}}const to=15.5;class QM{group=new fe;flame;isActive=!1;powerWatts=0;time=0;constructor(){this.group.name="equipment_burner";const t=new vt({color:2764339,roughness:.55,metalness:.6}),e=[new H(0,0),new H(4.6,0),new H(4.6,.5),new H(4,1),new H(1.6,1.8),new H(.9,2.2),new H(0,2.2)],n=new J(new Ue(e,40),t);n.castShadow=!0,n.receiveShadow=!0,this.group.add(n);const s=new vt({color:13214809,metalness:1,roughness:.3}),r=new J(new ne(.55,.6,to-2.2,24),s);r.position.y=2.2+(to-2.2)/2,r.castShadow=!0,this.group.add(r);const o=new J(new ne(.75,.75,1.4,24),s);o.position.y=3.6,this.group.add(o);const a=new J(new ne(.3,.35,3.2,12),s);a.rotation.z=Math.PI/2,a.position.set(-2,1.9,0),this.group.add(a);const l=new _o([new T(-3.5,1.9,0),new T(-6.5,1.2,1.5),new T(-9,.5,6),new T(-12,.45,14),new T(-16,.45,20)]),c=new J(new sr(l,40,.42,10,!1),new vt({color:12601117,roughness:.6}));c.castShadow=!0,this.group.add(c),this.flame=new Wu(1),this.flame.configure(0,2,9,{luminosity:0,emitterAmount:0}),this.flame.setInnerCone(!0),this.flame.group.position.y=to,this.group.add(this.flame.group),this.group.traverse(h=>h.raycast=()=>{})}ignite(t=800){this.isActive=!0,this.powerWatts=t,this.flame.setTarget(1)}extinguish(){this.isActive=!1,this.powerWatts=0,this.flame.setTarget(0)}update(t,e){}animate(t){this.time+=t,this.flame.tick(t,this.time)}brightness(){return this.flame.brightness(this.time)*.5}getControls(){return{burner_w:this.isActive?this.powerWatts:0,igniter:this.isActive}}}class tx extends Lu{constructor(){super();const t=new qe;t.deleteAttribute("uv");const e=new vt({side:Ye}),n=new vt,s=new Hu(16777215,900,28,2);s.position.set(.418,16.199,.3),this.add(s);const r=new J(t,e);r.position.set(-.757,13.219,.717),r.scale.set(31.713,28.305,28.591),this.add(r);const o=new J(t,n);o.position.set(-10.906,2.009,1.846),o.rotation.set(0,-.195,0),o.scale.set(2.328,7.905,4.651),this.add(o);const a=new J(t,n);a.position.set(-5.607,-.754,-.758),a.rotation.set(0,.994,0),a.scale.set(1.97,1.534,3.955),this.add(a);const l=new J(t,n);l.position.set(6.167,.857,7.803),l.rotation.set(0,.561,0),l.scale.set(3.927,6.285,3.687),this.add(l);const c=new J(t,n);c.position.set(-2.017,.018,6.124),c.rotation.set(0,.333,0),c.scale.set(2.002,4.566,2.064),this.add(c);const h=new J(t,n);h.position.set(2.291,-.756,-2.621),h.rotation.set(0,-.286,0),h.scale.set(1.546,1.552,1.496),this.add(h);const u=new J(t,n);u.position.set(-2.193,-.369,-5.547),u.rotation.set(0,.516,0),u.scale.set(3.875,3.487,2.986),this.add(u);const d=new J(t,qi(50));d.position.set(-16.116,14.37,8.208),d.scale.set(.1,2.428,2.739),this.add(d);const f=new J(t,qi(50));f.position.set(-16.109,18.021,-8.207),f.scale.set(.1,2.425,2.751),this.add(f);const g=new J(t,qi(17));g.position.set(14.904,12.198,-1.832),g.scale.set(.15,4.265,6.331),this.add(g);const _=new J(t,qi(43));_.position.set(-.462,8.89,14.52),_.scale.set(4.38,5.441,.088),this.add(_);const m=new J(t,qi(20));m.position.set(3.235,11.486,-12.541),m.scale.set(2.5,2,.1),this.add(m);const p=new J(t,qi(100));p.position.set(0,20,0),p.scale.set(1,.1,1),this.add(p)}dispose(){const t=new Set;this.traverse(e=>{e.isMesh&&(t.add(e.geometry),t.add(e.material))});for(const e of t)e.dispose()}}function qi(i){const t=new Sn;return t.color.setScalar(i),t}const Wt={xMin:-120,xMax:120,zMin:-45,zMax:32,thickness:3.2,floorY:-90},ve={tiers:[1.6,21.6,41.6],slots:9,spacing:12.6,z:-36.5,xCenter:0};function ex(i,t){const e=new fl(t),n=e.fromScene(new tx,.04);i.environment=n.texture,i.environmentIntensity=.62,e.dispose(),i.background=new St(14015198);const s=new l_(16054267,5985872,.35);i.add(s);const r=new aa(16774374,2.3);r.position.set(-55,170,95),r.target.position.set(0,0,-6),r.castShadow=!0,r.shadow.mapSize.set(2048,2048);const o=r.shadow.camera;o.left=-135,o.right=135,o.top=95,o.bottom=-95,o.near=40,o.far=380,r.shadow.bias=-4e-4,r.shadow.normalBias=.1,r.shadow.radius=3,i.add(r,r.target);const a=new aa(14477311,.55);a.position.set(110,80,70),i.add(a);const l=new aa(16777215,.35);l.position.set(30,120,-120),i.add(l);const c=new Hu(16751164,0,160,2);c.position.set(0,20,0),i.add(c);const h=q_(),u=h.map.clone();u.repeat.set(2.2,.75),u.needsUpdate=!0;const d=h.roughnessMap.clone();d.repeat.set(2.2,.75),d.needsUpdate=!0;const f=new sn({map:u,roughnessMap:d,roughness:.55,metalness:0,clearcoat:.35,clearcoatRoughness:.35,envMapIntensity:.8}),g=Wt.xMax-Wt.xMin,_=Wt.zMax-Wt.zMin,m=new us,p=1.2;m.moveTo(Wt.xMin,Wt.zMin),m.lineTo(Wt.xMax,Wt.zMin),m.lineTo(Wt.xMax,Wt.zMax-p),m.quadraticCurveTo(Wt.xMax,Wt.zMax,Wt.xMax-p,Wt.zMax),m.lineTo(Wt.xMin+p,Wt.zMax),m.quadraticCurveTo(Wt.xMin,Wt.zMax,Wt.xMin,Wt.zMax-p),m.lineTo(Wt.xMin,Wt.zMin);const x=new Ci(m,{depth:Wt.thickness-.8,bevelEnabled:!0,bevelThickness:.4,bevelSize:.4,bevelSegments:3,curveSegments:4});x.rotateX(Math.PI/2),x.translate(0,-.4,0);{const _t=x.attributes.position,Et=new Float32Array(_t.count*2);for(let $=0;$<_t.count;$++)Et[$*2]=(_t.getX($)-Wt.xMin)/g,Et[$*2+1]=(_t.getZ($)-Wt.zMin)/_+_t.getY($)*.01;x.setAttribute("uv",new Re(Et,2))}const M=new J(x,f);M.receiveShadow=!0,M.castShadow=!1,i.add(M);const v=j_().clone();v.repeat.set(3,1),v.wrapS=ss,v.needsUpdate=!0;const A=new vt({map:v,roughness:.6,metalness:0}),E=new J(new qe(g-4,90-Wt.thickness-10,_-6),[new vt({color:13225419,roughness:.7}),new vt({color:13225419,roughness:.7}),new vt({color:13225419,roughness:.7}),new vt({color:13225419,roughness:.7}),A,new vt({color:13225419,roughness:.7})]),R=90-Wt.thickness-10;E.position.set(0,-3.2-R/2,(Wt.zMin+Wt.zMax)/2-2),E.receiveShadow=!0,i.add(E);const P=new J(new qe(g-6,10,_-12),new vt({color:2961459,roughness:.8}));P.position.set(0,Wt.floorY+5,(Wt.zMin+Wt.zMax)/2-5),i.add(P);const b=$_().clone();b.repeat.set(12,12),b.needsUpdate=!0;const y=new J(new ze(600,600),new vt({map:b,roughness:.75}));y.rotation.x=-Math.PI/2,y.position.set(0,Wt.floorY,100),y.receiveShadow=!0,i.add(y);const I=Y_(),F=_t=>{const Et=_t.clone();return Et.repeat.set(320/60,75/30),Et.needsUpdate=!0,Et},U=new vt({map:F(I.map),roughnessMap:F(I.roughnessMap),bumpMap:F(I.bumpMap),bumpScale:.6,roughness:1,metalness:0}),O=new J(new ze(320,75),U);O.position.set(0,37.5,Wt.zMin),O.receiveShadow=!0,i.add(O);const V=X_("#dfe3dd").clone();V.repeat.set(4,2),V.needsUpdate=!0;const G=new vt({map:V,roughness:.92,metalness:0}),D=new J(new ze(320,140),G);D.position.set(0,145,Wt.zMin),i.add(D);const N=new J(new ze(320,90),G);N.position.set(0,Wt.floorY/2,Wt.zMin-.2),i.add(N);for(const _t of[-160,160]){const Et=new J(new ze(400,310),G);Et.position.set(_t,Wt.floorY+155,155),Et.rotation.y=_t<0?Math.PI/2:-Math.PI/2,Et.receiveShadow=!0,i.add(Et)}const j=new J(new ze(110,90),new Sn({map:K_(),toneMapped:!1,color:16777215}));j.position.set(-159.5,70,40),j.rotation.y=Math.PI/2,i.add(j);const it=new J(new qe(8,2,116),new vt({color:15330280,roughness:.5}));it.position.set(-157,24,40),i.add(it);const ut=new J(new ze(320,400),new vt({color:15922161,roughness:.95}));ut.rotation.x=Math.PI/2,ut.position.set(0,220,155),i.add(ut);for(const _t of[-60,60]){const Et=new J(new ze(60,30),new Sn({color:16777215,toneMapped:!1}));Et.rotation.x=Math.PI/2,Et.position.set(_t,219.5,20),i.add(Et)}const Dt=qu().clone();Dt.repeat.set(1.5,1),Dt.needsUpdate=!0;const $t=new vt({map:Dt,roughness:.6,metalness:0,color:15260875}),Q=new vt({color:12830924,metalness:1,roughness:.32}),st=ve.slots*ve.spacing+4,ft=13,rt=ve.xCenter-st/2;for(let _t=0;_t<ve.tiers.length;_t++){const Et=ve.tiers[_t],$=new J(new qe(st,1.6,ft),$t);$.position.set(ve.xCenter,Et-.8,ve.z),$.castShadow=!0,$.receiveShadow=!0,i.add($);const at=new J(new ne(.35,.35,st,10),Q);at.rotation.z=Math.PI/2,at.position.set(ve.xCenter,Et+3,ve.z+ft/2-.4),at.castShadow=!0,i.add(at);for(const L of[rt+.4,rt+st-.4]){const Tt=new J(new ne(.3,.3,3,8),Q);Tt.position.set(L,Et+1.5,ve.z+ft/2-.4),i.add(Tt)}}const Pt=ve.tiers[ve.tiers.length-1]+24;for(const _t of[rt+.9,rt+st-.9])for(const Et of[ve.z-ft/2+.9,ve.z+ft/2-.9]){const $=new J(new ne(.75,.75,Pt,14),Q);$.position.set(_t,Pt/2,Et),$.castShadow=!0,i.add($)}const Lt=ve.tiers.map(_t=>{const Et=[];for(let $=0;$<ve.slots;$++)Et.push(new T(ve.xCenter-(ve.slots-1)*ve.spacing/2+$*ve.spacing,_t,ve.z));return Et});return nx(i),{keyLight:r,fireLight:c,shelfSlots:Lt,dispose:()=>n.dispose()}}function nx(i){const t=new sn({color:15987954,roughness:.4,transmission:0,transparent:!0,opacity:.92,sheen:.3}),e=[new H(0,0),new H(3.6,0),new H(3.9,.6),new H(3.9,14),new H(3,16),new H(1.4,17.2),new H(1.4,18),new H(0,18)],n=new fe,s=new J(new Ue(e,32),t);s.castShadow=!0,n.add(s);const r=new vt({color:3112912,roughness:.45}),o=new J(new ne(1.7,1.7,1.8,24),r);o.position.y=18.8,n.add(o);const a=new J(new sr(new _o([new T(0,19.6,0),new T(0,23,0),new T(1.5,25,0),new T(5,24,0)]),20,.22,8),new vt({color:15790318,roughness:.5}));n.add(a),n.position.set(-104,0,-20),n.rotation.y=.6,i.add(n);const l=new J(new ne(6,6,24,40),new vt({color:16184816,roughness:.95}));l.rotation.z=Math.PI/2,l.position.set(104,7.2,-32),l.castShadow=!0,l.receiveShadow=!0,i.add(l);const c=new J(new qe(30,1,10),new vt({color:12107201,metalness:1,roughness:.35}));c.position.set(104,.5,-32),i.add(c)}const ix={liquid:[0,1,2],dropper:[1,0,2],jar:[2,1,0]};class sx{constructor(t,e){this.scene=t,this.slots=e,this.occupied=e.map(n=>n.map(()=>null))}entries=new Map;meta=new Map;occupied;clock=0;busy=new Set;onChange;get capacity(){return this.slots.reduce((t,e)=>t+e.length,0)}getMeta(t){return this.meta.get(t)}get(t){return this.entries.get(t)?.asm}assemblies(){return Array.from(this.entries.values(),t=>t.asm)}touch(t){const e=this.entries.get(t);e&&(e.lastUsed=++this.clock)}setBusy(t,e){e?this.busy.add(t):this.busy.delete(t)}add(t){const e=this.meta.get(t.id);e?.colorHex&&!t.colorHex&&(t={...t,colorHex:e.colorHex}),this.meta.set(t.id,t);const n=this.entries.get(t.id);if(n)return n.lastUsed=++this.clock,n.asm;const s=Qu(t);let r=this.freeSlot(s);if(!r){const l=this.lru();if(!l)return;r={tier:l.tier,slot:l.slot},this.evict(l.input.id)}const o=ed(t),a=this.slots[r.tier][r.slot];return o.group.position.copy(a),o.group.rotation.y=rx(t.id)%100/100*.3-.15,this.scene.add(o.group),this.occupied[r.tier][r.slot]=t.id,this.entries.set(t.id,{input:t,asm:o,tier:r.tier,slot:r.slot,lastUsed:++this.clock}),this.onChange?.(),o}evict(t){const e=this.entries.get(t);e&&(this.occupied[e.tier][e.slot]=null,this.entries.delete(t),e.asm.dispose(),this.onChange?.())}homeOf(t){const e=this.entries.get(t);return e?this.slots[e.tier][e.slot].clone():void 0}freeSlot(t){for(const e of ix[t]){if(e>=this.slots.length)continue;const n=this.occupied[e];for(let s=0;s<n.length;s++)if(!n[s])return{tier:e,slot:s}}return null}lru(){let t=null;for(const e of this.entries.values())this.busy.has(e.input.id)||(!t||e.lastUsed<t.lastUsed)&&(t=e);return t}}function rx(i){let t=0;for(let e=0;e<i.length;e++)t=t*31+i.charCodeAt(e)>>>0;return t}class ox{tasks=[];finish=new Map;add(t,e){this.tasks.push(t),e&&this.finish.set(t,e)}tick(t,e){for(let n=0;n<this.tasks.length;){const s=this.tasks[n];let r=!0;try{r=s.update(t,e)}catch(o){console.error("[bench] animation task failed",o),r=!0}if(r){this.tasks.splice(n,1);const o=this.finish.get(s);o&&(this.finish.delete(s),o())}else n++}}get active(){return this.tasks.length>0}isBusy(t){return this.tasks.some(e=>e.owns?.includes(t))}}const He={inOut:i=>i<.5?2*i*i:1-Math.pow(-2*i+2,2)/2,out:i=>1-(1-i)*(1-i),in:i=>i*i,smooth:i=>i*i*(3-2*i)};function or(i){let t=!1;return()=>{if(!t){t=!0;try{i?.()}catch(e){console.error("[bench] onComplete threw",e)}}}}const Mi=981,co=new T(0,1,0);function ax(i,t,e,n,s){const a=[],l=[],c=[],h=[],u=new T().crossVectors(t,co).normalize(),d=new T,f=new T,g=new T,_=new T;for(let p=0;p<=40;p++){const x=p/40;d.copy(i).addScaledVector(t,e*x),d.y-=n*x*x,f.copy(t).multiplyScalar(e).addScaledVector(co,-2*n*x).normalize(),g.copy(u),_.crossVectors(f,g).normalize();const M=s*(1-.45*Math.sqrt(x));for(let v=0;v<=10;v++){const A=v/10*Math.PI*2,E=g.x*Math.cos(A)+_.x*Math.sin(A),R=g.y*Math.cos(A)+_.y*Math.sin(A),P=g.z*Math.cos(A)+_.z*Math.sin(A);a.push(d.x+E*M,d.y+R*M,d.z+P*M),l.push(E,R,P),c.push(x)}}for(let p=0;p<40;p++)for(let x=0;x<10;x++){const M=p*11+x,v=M+10+1;h.push(M,v,M+1,v,v+1,M+1)}const m=new pe;return m.setAttribute("position",new jt(a,3)),m.setAttribute("normal",new jt(l,3)),m.setAttribute("aS",new jt(c,1)),m.setIndex(h),m}function lx(i){const t=new St(i),e=t.r*.3+t.g*.59+t.b*.11,n={value:0},s={value:0},r={value:0},o=new sn({color:e>.82?new St(15660795):t,roughness:.04,metalness:0,ior:1.333,transparent:!0,opacity:e>.82?.32:.82,envMapIntensity:1.6,depthWrite:!1,clearcoat:.5});return o.onBeforeCompile=a=>{a.uniforms.uHead=n,a.uniforms.uTail=s,a.uniforms.uTimeS=r,a.vertexShader=a.vertexShader.replace("#include <common>",`#include <common>
attribute float aS;
varying float vS;
uniform float uTimeS;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vS = aS;
transformed += normal * 0.03 * sin( aS * 40.0 - uTimeS * 30.0 );`),a.fragmentShader=a.fragmentShader.replace("#include <common>",`#include <common>
varying float vS;
uniform float uHead;
uniform float uTail;`).replace("void main() {",`void main() {
if ( vS > uHead || vS < uTail ) discard;`)},o.customProgramCacheKey=()=>"pour_stream",{mat:o,head:n,tail:s,time:r}}function Lh(i,t,e,n,s){const r=t.object,o=r.position.clone(),a=r.quaternion.clone(),l=e.group.position.clone(),c=l.y+e.profile.rimY+e.profile.baseOffsetY,h=e.profile.rimOuterRadius,u=new T(o.x-l.x,0,o.z-l.z);u.lengthSq()<1e-4&&u.set(-1,0,0),u.normalize();const d=u.clone().negate(),f=Math.atan2(u.z,-u.x),g=new _e().setFromAxisAngle(co,f),_=l.clone().addScaledVector(u,h+.45),m=t.lipLocal.x,p=t.lipHeight,x=t.bodyRadius,M=dt=>Math.max(0,p*Math.cos(dt)+(x-m)*Math.sin(dt),p*Math.cos(dt)-(x+m)*Math.sin(dt)),v=t.isBottle?1.15:Math.max(.35,Math.min(1.45,Math.atan2(Math.max(.2,p-t.fillHeight),Math.max(.5,m)))),A=t.isBottle?1.85:Math.min(1.95,v+.4),E=Math.max(t.groundY,0),R=Math.max(c+1,E+.8+M(v-.2)),P=dt=>Math.max(R,E+.8+M(dt)),b=new _e,y=new T,I=(dt,C,S)=>{b.setFromAxisAngle(new T(0,0,1),-dt),S.copy(g).multiply(b),y.copy(t.lipLocal).applyQuaternion(S),C.set(_.x,P(dt),_.z).sub(y)},F=new T,U=new _e;I(0,F,U),F.y+=1.5;const O=new T,V=new _e;I(Math.max(0,v-.25),O,V);const G=new T(_.x,R,_.z).addScaledVector(d,.1),D=l.y+e.surfaceLocalY(),N=Math.max(.5,G.y-D),j=h+.45-e.profile.rimInnerRadius*.25,it=ax(G,d,j,N,t.isBottle?.27:.34),ut=lx(n),Dt=new J(it,ut.mat);Dt.frustumCulled=!1,Dt.raycast=()=>{},Dt.visible=!1,i.add(Dt);const $t=new T(G.x,D,G.z).addScaledVector(d,j),Q=new St(n),st=Math.sqrt(2*N/Mi),ft=.5,rt=.35,Pt=.85,Lt=.25,_t=.55,Et=ft+rt,$=Et+Pt,at=$+Lt+_t;let L=0,Tt=!1,ot=0;const bt=or(s);t.onStart?.(),t.temporary&&r.scale.setScalar(.01);const lt=new T,Bt=new _e;return{owns:[r,e.group],update:(dt,C)=>{if(L+=dt,ut.time.value=C,Dt.renderOrder=e.glassMesh.renderOrder-1,L<ft){const S=He.inOut(L/ft);lt.lerpVectors(o,F,S),lt.y+=Math.sin(S*Math.PI)*6,Bt.slerpQuaternions(a,U,S),r.position.copy(lt),r.quaternion.copy(Bt),t.temporary&&r.scale.setScalar(Math.max(.01,Math.min(1,L/.25)))}else if(L<$+Lt){let S;if(L<Et?S=v*He.inOut((L-ft)/rt):L<$?S=v+(A-v)*He.smooth((L-Et)/Pt):S=A+(Math.max(0,v-.25)-A)*He.inOut((L-$)/Lt),I(S,lt,Bt),L<ft+.08&&lt.lerp(F,1-(L-ft)/.08),r.position.copy(lt),r.quaternion.copy(Bt),L>=Et){Dt.visible=!0;const W=L-Et;if(ut.head.value=Math.min(1,Math.sqrt(Math.min(1,.5*Mi*W*W/N+W*1.5))),L>$){const K=L-$;ut.tail.value=Math.min(1.01,Math.sqrt(Math.min(1,.5*Mi*K*K/N+K*2)))}if(!Tt&&W>=st*.9){Tt=!0;const K=e.glassRoot.worldToLocal($t.clone());e.effects.splashAt(K.x,K.z,Q,10,1),e.liquid.slosh(.03,d.x,d.z),bt()}if(Tt&&L<$+.1&&C-ot>.12){ot=C;const K=e.glassRoot.worldToLocal($t.clone());e.effects.splashAt(K.x,K.z,Q,2,.6)}}}else if(L<at){Dt.visible=ut.tail.value<1;const S=L-$;ut.tail.value=Math.min(1.01,Math.sqrt(Math.min(1,.5*Mi*S*S/N+S*2)));const W=He.inOut((L-$-Lt)/_t);lt.lerpVectors(O,o,W),lt.y+=Math.sin(W*Math.PI)*5,Bt.slerpQuaternions(V,a,W),r.position.copy(lt),r.quaternion.copy(Bt),t.temporary&&r.scale.setScalar(Math.max(.01,Math.min(1,(at-L)/.25)))}else return r.position.copy(o),r.quaternion.copy(a),i.remove(Dt),it.dispose(),ut.mat.dispose(),bt(),t.onEnd?.(),!0;return!1}}}let Ih=null;function cx(i,t,e,n,s,r,o){Ih??=new ir(.23,14,10);const a=td();i.add(a);const l=new St(s),c=l.r*.3+l.g*.59+l.b*.11,h=new sn({color:c>.82?15660795:l,roughness:.03,transparent:!0,opacity:c>.82?.45:.85,envMapIntensity:2,depthWrite:!1}),u=e.group.position.clone(),d=u.y+e.profile.rimY+e.profile.baseOffsetY,f=new T(t.x-u.x,0,t.z-u.z);f.lengthSq()<1e-4&&f.set(-1,0,0),f.normalize();const g=u.clone().addScaledVector(f,e.profile.rimInnerRadius*.25);g.y=d+3;const _=o.fromAbove?g.clone().add(new T(0,14,0)):t.clone();a.position.copy(_);const m=a.getObjectByName("bulb"),p=Math.max(1,Math.min(8,Math.round(n))),x=p>4?.2:.3,M=.6,v=M+.15,A=v+(p-1)*x,E=()=>e.group.position.y+e.surfaceLocalY(),R=[];let P=0,b=0,y=-1;const I=or(r);return o.onStart?.(),{owns:[e.group],update:F=>{if(b+=F,b<M){const V=He.inOut(b/M);a.position.lerpVectors(_,g,V),a.position.y+=Math.sin(V*Math.PI)*8}else y<0&&a.position.copy(g);if(P<p&&b>=v+P*x){const V=new J(Ih,h);V.position.copy(g).add(new T(0,-.15,0)),V.raycast=()=>{},V.renderOrder=e.glassMesh.renderOrder-1,i.add(V),R.push({m:V,v:0,done:!1}),P++}const U=P<p&&b>v-.1?Math.max(0,1-Math.abs((b-v)%x/x-.5)*2):0;m.scale.set(1+U*.12,1-U*.22,1+U*.12);for(const V of R)if(!V.done&&(V.v+=Mi*F,V.m.position.y-=V.v*F,V.m.scale.set(1,1+Math.min(.5,V.v/400),1),V.m.position.y<=E())){V.done=!0,i.remove(V.m);const G=e.glassRoot.worldToLocal(V.m.position.clone());e.effects.splashAt(G.x,G.z,l,4,.5),I()}if(P>=p&&R.every(V=>V.done)&&y<0&&b>A+.25&&(y=b),y>=0){const V=Math.min(1,(b-y)/.6);if(a.position.lerpVectors(g,_,He.inOut(V)),a.position.y+=Math.sin(V*Math.PI)*8,V>=1){i.remove(a);for(const G of R)i.remove(G.m);return h.dispose(),I(),o.onEnd?.(),!0}}if(b>8){i.remove(a);for(const V of R)i.remove(V.m);return h.dispose(),I(),o.onEnd?.(),!0}return!1}}}function hx(i,t,e,n,s,r,o){const a=e.group.position.clone(),l=a.y+e.profile.rimY+e.profile.baseOffsetY,c=()=>e.group.position.y+e.surfaceLocalY(),h=or(r),u=new St(n);if(o.onStart?.(),s){const O=new J(Yu(),new vt({color:u.getHex()===16777215?12632774:u,metalness:1,roughness:.3,side:je})),V=Math.min(1,(e.profile.rimInnerRadius*2-.4)/5);O.scale.setScalar(Math.max(.35,V)),O.castShadow=!0,O.position.set(a.x,l+9,a.z),i.add(O);let G=0,D=0,N=!1;return{owns:[e.group],update:j=>{if(D+=j,D<.35)return O.position.y=l+9-He.out(D/.35)*3,!1;if(!N&&(G+=Mi*.6*j,O.position.y-=G*j,O.rotation.x+=j*4,O.rotation.y+=j*2,O.position.y<=c()+.1||D>3)){N=!0;const it=e.glassRoot.worldToLocal(O.position.clone());return e.effects.splashAt(it.x,it.z,new St(e.getLiquidColorHex()),8,.8),h(),i.remove(O),O.material.dispose(),o.onEnd?.(),!0}return!1}}}const d=FM(),f=new T(t.x-a.x,0,t.z-a.z);f.lengthSq()<1e-4&&f.set(-1,0,0),f.normalize();const g=Math.atan2(f.z,-f.x),_=new vt({color:u,roughness:.95}),m=new J(new ir(.55,14,8),_);m.scale.set(1,.45,.8),m.position.set(.3,.15,0),d.add(m);const p=a.clone().addScaledVector(f,e.profile.rimInnerRadius*.3);p.y=l+2.5;const x=new _e().setFromAxisAngle(co,g+Math.PI),M=t.clone();d.position.copy(M),d.quaternion.copy(x),i.add(d);const v=new Qr(160,Ml());v.fadeIn=0,v.points.renderOrder=e.glassMesh.renderOrder-1,i.add(v.points);const A=.6,E=.3,R=.6,P=.55;let b=0,y=0;const I=new T(1,0,0),F=new _e,U=new T;return{owns:[e.group],update:(O,V)=>{if(b+=O,b<A){const D=He.inOut(b/A);d.position.lerpVectors(M,p,D),d.position.y+=Math.sin(D*Math.PI)*8}else if(b<A+E+R){d.position.copy(p);const D=Math.min(1,(b-A)/E);if(F.setFromAxisAngle(I,He.inOut(D)*1.25),d.quaternion.copy(x).multiply(F),b>A+E*.5)for(m.scale.multiplyScalar(Math.max(0,1-O*3)),y+=220*O;y>=1;){y-=1,U.set(.3+Math.random()*.6,0,(Math.random()-.5)*.8).applyQuaternion(d.quaternion).add(d.position);const N=.85+Math.random()*.3;v.spawn(U.x,U.y,U.z,(Math.random()-.5)*3,-Math.random()*5,(Math.random()-.5)*3,2,.28,.22,.95,u.r*N,u.g*N,u.b*N,Mi*.5,1.5,0)}}else if(b<A+E+R+P){const D=He.inOut((b-A-E-R)/P);d.position.lerpVectors(p,M,D),d.position.y+=Math.sin(D*Math.PI)*8,d.quaternion.copy(x)}const G=c();for(let D=0;D<v.live;D++)if(v.pos[D*3+1]<=G){if(v.life[D]<v.maxLife[D]-.01){const N=e.glassRoot.worldToLocal(U.set(v.pos[D*3],G,v.pos[D*3+2]));Math.random()<.08&&e.liquid.impact(N.x,N.z,.3,V),h()}v.maxLife[D]=v.life[D]}return v.update(O),b>=A+E+R+P&&v.live===0?(i.remove(d),i.remove(v.points),v.dispose(),m.geometry.dispose(),_.dispose(),h(),o.onEnd?.(),!0):b>8?(i.remove(d),i.remove(v.points),v.dispose(),h(),o.onEnd?.(),!0):!1}}}function Dh(i,t,e,n=0){const s=i.position.clone(),r=Math.max(s.y,t.y,n)+5,o=.35,a=Math.min(1,.4+s.distanceTo(t)/120),l=.35;let c=0;const h=or(e);return{owns:[i],update:u=>{if(c+=u,c<o){const d=He.inOut(c/o);i.position.set(s.x,s.y+(r-s.y)*d,s.z)}else if(c<o+a){const d=He.inOut((c-o)/a);i.position.set(s.x+(t.x-s.x)*d,r,s.z+(t.z-s.z)*d)}else if(c<o+a+l){const d=He.out((c-o-a)/l);i.position.set(t.x,r+(t.y-r)*d,t.z)}else return i.position.copy(t),h(),!0;return!1}}}function ux(i){if(!i)return null;const t=i.includes("25")||i.includes("1 atm")||i.includes("760 mm"),e=i.match(/([-+]?[0-9]*\.?[0-9]+)\s*(?:°|deg|degrees)?\s*([CFK])/i);if(e){let n=parseFloat(e[1]);const s=e[2].toUpperCase();return s==="F"?n=(n-32)*(5/9):s==="K"&&(n=n-273.15),{value:Math.round(n*10)/10,unit:"°C",originalText:i,isStandardConditions:t}}return null}function dx(i){if(!i)return null;const t=i.includes("20")||i.includes("25")||i.includes("4 °C"),e=i.match(/([0-9]*\.?[0-9]+)\s*(?:g\/cm3|g\/cm\^?3|g\/cu\.?\s?cm|g\/mL|g\/cc|kg\/m3)/i);if(e){let n=parseFloat(e[1]);return i.toLowerCase().includes("kg/m3")&&(n=n/1e3),{value:Math.round(n*1e3)/1e3,unit:"g/cm³",originalText:i,isStandardConditions:t}}return null}function _a(i,t){if(i.length===0)return t;const e=i.filter(o=>o.isStandardConditions),s=(e.length>0?e:i).map(o=>o.value).sort((o,a)=>o-a),r=Math.floor(s.length/2);return s.length%2===0?(s[r-1]+s[r])/2:s[r]}function fx(i){if(!i)return[];const t=i.match(/H[0-9]{3}[a-zA-Z]*/g);return t?Array.from(new Set(t)):[]}function px(i,t){const e=new Set(t),n={},s=o=>{const a=o?.Value?.StringWithMarkup;return Array.isArray(a)?a.map(l=>typeof l?.String=="string"?l.String:"").filter(Boolean):[]},r=(o,a)=>{if(!(!o||typeof o!="object"||a>8)){if(typeof o.TOCHeading=="string"&&e.has(o.TOCHeading)){const l=n[o.TOCHeading]??=[];for(const c of o.Information??[])l.push(...s(c))}if(Array.isArray(o.Section))for(const l of o.Section)r(l,a+1);o.Record&&r(o.Record,a+1)}};return r(i,0),n}function mx(i){const t=i.slice(0,4).join(" ; ").toLowerCase(),e=[["solid",/\b(solid|powder|crystal\w*|flakes?|granul\w*|pellets?|prills?|needles?|plates?|lumps?|tablets?|dust|metal)\b/],["liquid",/\b(liquid|solution|oil|oily|syrup\w*)\b/],["gas",/\b(gas|vapou?r)\b/]];let n;for(const[s,r]of e){const o=r.exec(t);o&&(!n||o.index<n.i)&&(n={k:s,i:o.index})}return n?.k}const gx=[[/\b(colou?rless|clear|transparent)\b/,"#e8f4fa"],[/\bwhite\b/,"#f4f3ef"],[/\b(yellow|straw)\b/,"#e8d34a"],[/\borange\b/,"#e98a2b"],[/\bred\b/,"#c8332c"],[/\bpink\b/,"#e79bb4"],[/\b(purple|violet|lilac)\b/,"#7b4fa8"],[/\bblue\b/,"#3d6fc4"],[/\bgreen\b/,"#4f9a55"],[/\bbrown\b/,"#7b5233"],[/\bblack\b/,"#262626"],[/\b(gr[ae]y|silver\w*)\b/,"#9b9da0"]];function vx(i){const t=i.slice(0,4).join(" ; ").toLowerCase();let e;for(const[n,s]of gx){const r=n.exec(t);r&&(!e||r.index<e.i)&&(e={c:s,i:r.index})}if(e)return/\b(pale|light)\b/.test(t)&&e.c!=="#e8f4fa"&&e.c!=="#f4f3ef"?Uh(e.c,"#ffffff",.45):/\bdark\b/.test(t)?Uh(e.c,"#000000",.4):e.c}function Uh(i,t,e){const n=[1,3,5].map(r=>parseInt(i.slice(r,r+2),16)),s=[1,3,5].map(r=>parseInt(t.slice(r,r+2),16));return"#"+n.map((r,o)=>Math.round(r+(s[o]-r)*e).toString(16).padStart(2,"0")).join("")}function Vl(i){const t=i.userOverrides?.mp_c;if(typeof t=="number"&&isFinite(t))return t>28;if(i.state)return i.state==="solid";const e=i.sourcedProperties?.mp_c;return typeof e=="number"&&isFinite(e)&&e>28}const Wr=new T(0,0,6),_x=new T(46,0,-14),Mx=new T(80,0,-4),Ma=new T(-80,0,-12);class xx{scene;camera;renderer;controls;onSelectObject;onDeselect;instruments;onPourRequested;container;room;glasswareMap=new Map;shelf;animator=new ox;raycaster=new u_;pointer=new H;opticsTables=null;slots=[];slotOwner=[];vesselSlot=new Map;hotPlateVessel=null;selectedId=null;hoverKey=null;hoverDirty=!1;pointerInside=!1;downPos=null;thermoMotion;phMotion;thermoPark={pos:new T(26,yl+.05,7),up:new T(1,0,0)};phPark={pos:new T(33,Jn+.05,2.5),up:new T(.97,0,-.1).normalize()};transient=new Set;cameraTween=null;time=0;lastFrame=performance.now();shadowTimer=0;shadowDirty=!0;rafId=0;resizeObserver;footprints;constructor(t){this.container=t;const e=Math.max(1,t.clientWidth),n=Math.max(1,t.clientHeight);this.scene=new Lu,this.camera=new tn(40,e/n,4,900),this.camera.position.set(0,50,102),this.renderer=new Av({antialias:!0,alpha:!1,powerPreference:"high-performance"}),this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2)),this.renderer.setSize(e,n),this.renderer.outputColorSpace=we,this.renderer.toneMapping=nu,this.renderer.toneMappingExposure=1,this.renderer.shadowMap.enabled=!0,this.renderer.shadowMap.type=Qh,this.renderer.shadowMap.autoUpdate=!1,this.renderer.domElement.style.display="block",this.renderer.domElement.style.touchAction="none",t.appendChild(this.renderer.domElement),ph(n*this.renderer.getPixelRatio(),this.camera.fov),this.controls=new p_(this.camera,this.renderer.domElement),this.controls.target.set(0,15,-8),this.controls.enableDamping=!0,this.controls.dampingFactor=.08,this.controls.enablePan=!1,this.controls.minDistance=16,this.controls.maxDistance=190,this.controls.minPolarAngle=.12,this.controls.maxPolarAngle=1.38,this.controls.minAzimuthAngle=-1.35,this.controls.maxAzimuthAngle=1.35,this.controls.rotateSpeed=.6,this.controls.zoomSpeed=.9,this.controls.update(),this.room=ex(this.scene,this.renderer),this.shelf=new sx(this.scene,this.room.shelfSlots),this.shelf.onChange=()=>this.shadowDirty=!0;const s=new XM,r=new Hl,o=new KM,a=new ZM,l=new JM,c=new QM;l.group.position.copy(Wr),r.group.position.copy(_x),r.group.rotation.y=-.35,o.group.position.copy(Mx),o.group.rotation.y=-.3,c.group.position.copy(Ma),c.group.rotation.y=.4,this.scene.add(s.group,r.group,o.group,a.group,l.group,c.group),this.instruments={thermometer:s,phMeter:r,balance:o,pressureGauge:a,hotPlate:l,burner:c},this.thermoMotion={bundle:null,t:1,fromPos:new T,fromQuat:new _e},this.phMotion={bundle:null,t:1,fromPos:new T,fromQuat:new _e},this.updateProbes(0,!0),this.footprints=[{x0:-9.5,x1:9.5,z0:Wr.z-12,z1:Wr.z+12},{x0:36,x1:57,z0:-26,z1:-2},{x0:67,x1:93,z0:-19,z1:11},{x0:-97,x1:-73,z0:-18,z1:10}],this.buildSlots(),this.resizeObserver=new ResizeObserver(()=>this.onResize()),this.resizeObserver.observe(t),window.addEventListener("resize",this.onResize);const h=this.renderer.domElement;h.addEventListener("pointerdown",this.onPointerDown),h.addEventListener("pointerup",this.onPointerUp),h.addEventListener("pointermove",this.onPointerMove),h.addEventListener("pointerleave",this.onPointerLeave),this.animate()}buildSlots(){const n=[];for(const r of[-24,24,-39,39,-54,54,-69,69])n.push(new T(r,0,12));for(const r of[0,-15,15,-30,30,-45,45,-60,60])n.push(new T(r,0,-15));const s=7;this.slots=n.filter(r=>!this.footprints.some(o=>r.x>o.x0-s&&r.x<o.x1+s&&r.z>o.z0-s&&r.z<o.z1+s)),this.slotOwner=this.slots.map(()=>null)}allocSlot(t){let e=this.slotOwner.indexOf(null);if(e<0){const n=this.slots.length;this.slots.push(new T(-75+n%6*14,0,22)),this.slotOwner.push(null),e=this.slots.length-1}return this.slotOwner[e]=t,this.vesselSlot.set(t,e),e}freeSlotOf(t){const e=this.vesselSlot.get(t);e!==void 0&&(this.slotOwner[e]=null,this.vesselSlot.delete(t))}hotPlateTopWorld(){return this.instruments.hotPlate.topLocal.clone().add(Wr)}groundAt(t,e){const n=this.hotPlateTopWorld();return Math.abs(t-n.x)<9&&Math.abs(e-n.z)<9?Hs:0}addVessel(t,e,n){const s=this.glasswareMap.get(t.id);if(s)return s;const r=YM(t),o=this.allocSlot(t.id);return r.group.position.copy(this.slots[o]),r.group.rotation.y=0,this.scene.add(r.group),this.glasswareMap.set(t.id,r),this.shadowDirty=!0,r}removeVessel(t){const e=this.glasswareMap.get(t);e&&(this.selectedId===t&&this.setSelectedVessel(null),this.hotPlateVessel===t&&(this.hotPlateVessel=null),this.freeSlotOf(t),this.glasswareMap.delete(t),e.dispose(),this.scene.remove(e.group),this.shadowDirty=!0)}getGlassware(t){return this.glasswareMap.get(t)}getAllVessels(){return Array.from(this.glasswareMap.values()).map(t=>t.vesselState)}addReagentBottle(t){this.shelf.add(BM(t))}addBottle(t,e,n){const s=Vl(t);this.shelf.add({id:t.id,name:t.name,formula:t.formula,ghs:t.ghs,signal_word:t.ghs&&t.ghs.length?"Warning":"",bottle_colour:"clear",form:s?"solid":"solution",by_mass:s,colorHex:t.color})}setBottleContentColor(t,e){const n=this.shelf.getMeta(t);n&&(n.colorHex=e),this.shelf.get(t)?.setContentColor(e)}setOpticsTables(t){this.opticsTables=t,kM(t)}getOpticsTables(){return this.opticsTables}setSelectedVessel(t){const e=t?this.glasswareMap.get(t)??null:null,n=e?t:null;for(const[c,h]of this.glasswareMap)h.setSelected(c===n);const{thermometer:s,phMeter:r,balance:o,pressureGauge:a}=this.instruments,l=!!e&&(e.vesselState.isSealed||this.isSealed(e));a.attachTo(l?e:null),e&&!e.lastSnapshot&&e.effects.setSealed(e.vesselState.isSealed),n!==this.selectedId&&(this.selectedId=n,s.attachTo(e),r.attachTo(e),o.attachTo(e),this.startProbeMotion(this.thermoMotion,s.group,e),this.startProbeMotion(this.phMotion,r.probe,e))}isSealed(t){return t.lastSnapshot?t.lastSnapshot.sealed&&!t.lastSnapshot.burst:t.vesselState.isSealed}startProbeMotion(t,e,n){e.updateWorldMatrix(!0,!1),e.getWorldPosition(t.fromPos),e.getWorldQuaternion(t.fromQuat),t.bundle=n,t.t=0}updateInstruments(t,e){const{thermometer:n,phMeter:s,balance:r,pressureGauge:o,hotPlate:a,burner:l}=this.instruments,c=this.selectedId?this.glasswareMap.get(this.selectedId):void 0;if(c){const h=c.probeLocal("ph",Jn).tip;s.setImmersed(c.surfaceLocalY()-h.y>.5&&this.phMotion.t>=1);const u=t.sealed&&!t.burst;o.attachTo(u?c:null)}else s.setImmersed(!1);n.update(t,e),s.update(t,e),r.update(t,e),o.update(t,e),a.update(t,e),l.update(t,e)}probeTarget(t,e,n,s,r){const o=t.bundle;if(o&&this.glasswareMap.has(o.vesselState.id)&&!o.isBurst()){o.group.updateWorldMatrix(!0,!1);const{tip:a,up:l}=o.probeLocal(e,n);s.copy(a).applyMatrix4(o.group.matrixWorld);const c=l.clone().transformDirection(o.group.matrixWorld);r.setFromUnitVectors(new T(0,1,0),c),e==="thermo"&&this.spinToCamera(s,c,r)}else{const a=e==="thermo"?this.thermoPark:this.phPark;if(s.copy(a.pos),r.setFromUnitVectors(new T(0,1,0),a.up),e==="thermo"){const l=new _e().setFromAxisAngle(a.up,-Math.PI/2);r.premultiply(l)}}}spinToCamera(t,e,n){const s=new T(0,0,1).applyQuaternion(n),r=this.camera.position.clone().sub(t);if(r.addScaledVector(e,-r.dot(e)),r.lengthSq()<1e-6)return;r.normalize();const o=Math.atan2(new T().crossVectors(s,r).dot(e),s.dot(r));n.premultiply(new _e().setFromAxisAngle(e,o))}tmpPos=new T;tmpQuat=new _e;updateProbes(t,e=!1){const{thermometer:n,phMeter:s}=this.instruments,r=(l,c,h,u)=>{if(this.probeTarget(l,c,h,this.tmpPos,this.tmpQuat),e&&(l.t=1),l.t<1){l.t=Math.min(1,l.t+t/1);const d=He.inOut(l.t),f=l.fromPos.clone().lerp(this.tmpPos,d);f.y+=Math.sin(d*Math.PI)*18;const g=l.fromQuat.clone().slerp(this.tmpQuat,d);u(f,g),this.shadowDirty=!0}else u(this.tmpPos,this.tmpQuat)};r(this.thermoMotion,"thermo",yl,(l,c)=>{n.group.position.copy(l),n.group.quaternion.copy(c)}),r(this.phMotion,"ph",Jn,(l,c)=>s.setProbeWorldPose(l,c));const o=this.selectedId?this.glasswareMap.get(this.selectedId):void 0,a=this.instruments.pressureGauge;if(o&&a.group.visible){o.group.updateWorldMatrix(!0,!1);const l=new T(0,o.stopperTopLocal()-.6,0).applyMatrix4(o.group.matrixWorld);a.group.position.copy(l),a.group.quaternion.copy(o.group.quaternion),a.faceToward(this.camera.position)}}placeVesselOnHotPlate(t){const e=this.hotPlateVessel;if(t!==null&&!this.glasswareMap.has(t)||t!==null&&e===t)return null;let n=null;if(e&&this.glasswareMap.has(e)){const s=this.glasswareMap.get(e),r=this.allocSlot(e);this.animator.add(Dh(s.group,this.slots[r].clone(),()=>s.liquid.slosh(.04),Hs+s.height*.2)),n=e}if(this.hotPlateVessel=null,t!==null){const s=this.glasswareMap.get(t);this.freeSlotOf(t),this.hotPlateVessel=t,this.animator.add(Dh(s.group,this.hotPlateTopWorld(),()=>s.liquid.slosh(.05),Hs))}return this.shadowDirty=!0,n}getHotPlateVesselId(){return this.hotPlateVessel}registerTransient(t){const e={object:t.group,setRenderOrderBase:t.setRenderOrderBase};return this.transient.add(e),()=>this.transient.delete(e)}tempBottle(t,e,n,s){const r=this.shelf.getMeta(t),o=r?{...r}:{id:t,name:yx(t),formula:"",bottle_colour:"clear",form:"solution",colorHex:n};s==="liquid"&&(o.dropper=!1,o.form==="solid"&&(o.form="solution"),o.by_mass=!1);const a=ed(o),l=e.group.position,c=l.x>0?1:-1;let h=l.x+c*18;return(h>Wt.xMax-10||h<Wt.xMin+10)&&(h=l.x-c*18),a.group.position.set(h,this.groundAt(h,l.z+4),Math.min(Wt.zMax-6,l.z+4)),this.scene.add(a.group),a}animatePour(t,e,n,s){const r=ya(s);try{const o=this.glasswareMap.get(e);if(!o||o.isBurst()||t===e){r();return}const a=this.glasswareMap.get(t);if(a&&!this.animator.isBusy(a.group)&&!a.isBurst()){const g=a.lipLocal(),_=a.lastSnapshot?a.getLiquidColorHex():n||a.getLiquidColorHex(),m={object:a.group,lipLocal:g,lipHeight:g.y,bodyRadius:a.profile.maxOuterRadius,isBottle:!1,fillHeight:a.surfaceLocalY(),groundY:a.group.position.y,onStart:()=>a.setRackVisible(!1),onEnd:()=>{a.setRackVisible(!0),this.shadowDirty=!0}};this.animator.add(Lh(this.scene,m,o,_,r),r);return}let l=this.shelf.get(t),c=!1;l&&this.animator.isBusy(l.group)&&(l=void 0),l&&l.kind!=="liquid"&&(l=void 0),l?this.shelf.touch(t):(l=this.tempBottle(t,o,n,"liquid"),c=!0);const h=l;let u=null;const d=xa(n,h.contentHex),f={object:h.group,lipLocal:h.lipLocal,lipHeight:h.lipLocal.y,bodyRadius:h.radius,isBottle:!0,fillHeight:0,groundY:h.group.position.y,temporary:c,onStart:()=>{h.cap.visible=!1,c?u=this.registerTransient(h):this.shelf.setBusy(t,!0)},onEnd:()=>{h.cap.visible=!0,this.shadowDirty=!0,c?(u?.(),h.dispose()):this.shelf.setBusy(t,!1)}};this.animator.add(Lh(this.scene,f,o,d,r),r)}catch(o){console.error("[bench] animatePour failed",o),r()}}animateDrops(t,e,n,s,r){const o=ya(r);try{const a=this.glasswareMap.get(e);if(!a||a.isBurst()){o();return}const l=this.shelf.get(t);let c,h=!1,u,d;if(l&&l.dropperParts&&l.dropperParts.visible){this.shelf.touch(t),c=new T(0,l.lipLocal.y-7,0),l.group.localToWorld(c);const g=l.dropperParts;u=()=>{g.visible=!1,this.shelf.setBusy(t,!0)},d=()=>{g.visible=!0,this.shelf.setBusy(t,!1)}}else c=a.group.position.clone(),h=!0;const f=xa(s,l?.contentHex??this.shelfMetaColor(t,!1));this.animator.add(cx(this.scene,c,a,n,f,o,{onStart:u,onEnd:d,fromAbove:h}),o)}catch(a){console.error("[bench] animateDrops failed",a),o()}}animateSolidAddition(t,e,n,s){const r=ya(s);try{const o=this.glasswareMap.get(e);if(!o||o.isBurst()){r();return}const a=this.shelf.getMeta(t),l=a?Ju(a.formula,a.name)&&(a.form==="solid"||!!a.by_mass):/(^|[_\-\s])(mg|zn|fe|al|cu|sn)([_\-\s]|$)/i.test(t),c=this.shelf.get(t);let h;c?(this.shelf.touch(t),h=new T(0,c.height+2,0),c.group.localToWorld(h)):h=o.group.position.clone().add(new T(-14,o.height+10,6));const u=xa(n,c?.contentHex??this.shelfMetaColor(t,!0));this.animator.add(hx(this.scene,h,o,u,l,r,{onStart:()=>c&&this.shelf.setBusy(t,!0),onEnd:()=>{this.shelf.setBusy(t,!1),this.shadowDirty=!0}}),r)}catch(o){console.error("[bench] animateSolidAddition failed",o),r()}}shelfMetaColor(t,e){const n=this.shelf.getMeta(t);return n?n.colorHex||Zu(e):void 0}triggerBurst(t){const e=this.glasswareMap.get(t);e&&(e.effects.triggerBurst(),this.shadowDirty=!0)}focusVessel(t){const e=this.glasswareMap.get(t);if(!e)return;const n=this.controls.target.clone(),s=this.camera.position.clone(),r=e.group.position.clone().add(new T(0,e.height*.45,0)),o=s.clone().sub(n),a=Il.clamp(Math.max(32,e.height*3.4),this.controls.minDistance,Math.min(o.length(),90)),l=r.clone().add(o.normalize().multiplyScalar(a));let c=0;const h={update:u=>{if(this.cameraTween!==h)return!0;c=Math.min(1,c+u/.85);const d=He.inOut(c);return this.controls.target.lerpVectors(n,r,d),this.camera.position.lerpVectors(s,l,d),c>=1?(this.cameraTween=null,!0):!1}};this.cameraTween=h,this.animator.add(h)}setPointer(t){const e=this.renderer.domElement.getBoundingClientRect();this.pointer.x=(t.clientX-e.left)/Math.max(1,e.width)*2-1,this.pointer.y=-((t.clientY-e.top)/Math.max(1,e.height))*2+1}pick(){this.raycaster.setFromCamera(this.pointer,this.camera);const t=[];for(const n of this.glasswareMap.values())n.isBurst()||t.push(n.pickProxy);for(const n of this.shelf.assemblies())t.push(n.pickProxy);for(const n of t)n.updateWorldMatrix(!0,!1);const e=this.raycaster.intersectObjects(t,!1);for(const n of e){const s=n.object.userData.pick;if(s)return s}return null}onPointerDown=t=>{this.downPos={x:t.clientX,y:t.clientY,t:performance.now(),button:t.button}};onPointerUp=t=>{const e=this.downPos;if(this.downPos=null,!e||e.button!==0||t.button!==0||Math.hypot(t.clientX-e.x,t.clientY-e.y)>5||performance.now()-e.t>800)return;this.setPointer(t);const s=this.pick();s?(s.type==="bottle"&&this.shelf.touch(s.id),this.onSelectObject?.(s.type,s.id)):this.onDeselect?.()};onPointerMove=t=>{this.pointerInside=!0,this.setPointer(t),this.hoverDirty=!0};onPointerLeave=()=>{this.pointerInside=!1,this.hoverDirty=!0};updateHover(){if(!this.hoverDirty)return;this.hoverDirty=!1;const t=!!this.downPos,e=this.pointerInside&&!t?this.pick():null,n=e?`${e.type}:${e.id}`:null;if(n!==this.hoverKey){this.hoverKey=n;for(const[s,r]of this.glasswareMap)r.setHover(e?.type==="vessel"&&e.id===s);for(const s of this.shelf.assemblies())s.setHover(e?.type==="bottle"&&s.group.userData.pick?.id===e.id);this.renderer.domElement.style.cursor=e?"pointer":"grab"}}onResize=()=>{const t=Math.max(1,this.container.clientWidth),e=Math.max(1,this.container.clientHeight);this.camera.aspect=t/e,this.camera.updateProjectionMatrix(),this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2)),this.renderer.setSize(t,e),ph(e*this.renderer.getPixelRatio(),this.camera.fov)};sortRenderOrder(){const t=this.camera.position,e=[];for(const n of this.glasswareMap.values())e.push({d:n.group.position.distanceToSquared(t),set:n.setRenderOrderBase});for(const n of this.shelf.assemblies())e.push({d:n.group.position.distanceToSquared(t),set:n.setRenderOrderBase});for(const n of this.transient)e.push({d:n.object.position.distanceToSquared(t),set:n.setRenderOrderBase});e.sort((n,s)=>s.d-n.d);for(let n=0;n<e.length;n++)e[n].set(10+n*10)}animate=()=>{this.rafId=requestAnimationFrame(this.animate);const t=performance.now(),e=Math.min(.05,Math.max(0,(t-this.lastFrame)/1e3));this.lastFrame=t,this.time+=e;const n=this.time;this.downPos&&(this.cameraTween=null),this.controls.update();const s=this.animator.active;this.animator.tick(e,n);let r=0;const o=new T,a=this.room.fireLight.position;for(const u of this.glasswareMap.values()){u.setGroundY(this.groundAt(u.group.position.x,u.group.position.z)),u.tick(e,n);const d=u.effects.flameStrength(n);d>r&&(r=d,o.set(0,u.profile.baseOffsetY+u.effects.flameLocalY(),0).applyMatrix4(u.group.matrixWorld),a.copy(o))}const{hotPlate:l,burner:c}=this.instruments;l.animate(e),c.animate(e);const h=c.brightness();h>r&&(r=h,a.set(Ma.x,to+4,Ma.z)),this.room.fireLight.intensity=r*1500,this.updateProbes(e),this.updateHover(),this.sortRenderOrder(),this.shadowTimer+=e,(this.shadowDirty||s||this.shadowTimer>.5)&&(this.renderer.shadowMap.needsUpdate=!0,this.shadowDirty=!1,this.shadowTimer=0),this.renderer.render(this.scene,this.camera)};dispose(){cancelAnimationFrame(this.rafId),this.resizeObserver.disconnect(),window.removeEventListener("resize",this.onResize),this.controls.dispose();for(const t of Array.from(this.glasswareMap.keys()))this.removeVessel(t);this.room.dispose(),this.renderer.dispose(),this.renderer.domElement.remove()}}function xa(i,t){if(!i)return t||"#f2f6f8";if(!t)return i;const e=new St(i),n=Math.min(e.r,e.g,e.b)>.8,s=new St(t),r=Math.max(s.r,s.g,s.b)-Math.min(s.r,s.g,s.b)>.12||Math.max(s.r,s.g,s.b)<.5;return n&&r?t:i}function ya(i){const t=or(i);return setTimeout(t,7e3),t}function yx(i){return i.replace(/[_-]+/g," ").replace(/\b\w/g,t=>t.toUpperCase())}class bx{worker;pendingRequests=new Map;reqSeq=0;vesselHandles=new Map;activeVesselIds=[];speedMultiplier=1;isPaused=!1;simIntervalId=null;onSnapshotUpdated;constructor(t){this.worker=t,this.worker.addEventListener("message",this.handleWorkerMessage),this.startSimulationClock()}handleWorkerMessage=t=>{const{type:e,payload:n,requestId:s,error:r}=t.data;if(s&&this.pendingRequests.has(s)){const{resolve:o,reject:a}=this.pendingRequests.get(s);this.pendingRequests.delete(s),r?a(new Error(r)):o(n)}};sendRequest(t,e={}){return new Promise((n,s)=>{const r=`req_${++this.reqSeq}_${Date.now()}`;this.pendingRequests.set(r,{resolve:n,reject:s}),this.worker.postMessage({type:t,payload:e,requestId:r})})}async getOpticsTables(){return this.sendRequest("OPTICS_TABLES")}async getReagentCatalog(){return this.sendRequest("REAGENT_CATALOG")}async createVessel(t,e){const n=await this.sendRequest("VESSEL_NEW",{config:e});return this.vesselHandles.set(t,n.handle),this.activeVesselIds.includes(t)||this.activeVesselIds.push(t),n.handle}async freeVessel(t){const e=this.vesselHandles.get(t);if(e===void 0)return!1;const n=await this.sendRequest("VESSEL_FREE",{handle:e});return this.vesselHandles.delete(t),this.activeVesselIds=this.activeVesselIds.filter(s=>s!==t),n.ok}async dose(t,e){const n=this.vesselHandles.get(t);if(n===void 0)throw new Error(`Vessel ${t} not found`);const s=await this.sendRequest("VESSEL_DOSE",{handle:n,dose:e});return await this.fetchSnapshot(t),s}async removeLiquid(t,e,n=!1){const s=this.vesselHandles.get(t);if(s===void 0)throw new Error(`Vessel ${t} not found`);const r=await this.sendRequest("VESSEL_REMOVE_LIQUID",{handle:s,volume_ml:e,include_solids:n});return await this.fetchSnapshot(t),r}async addPortion(t,e){const n=this.vesselHandles.get(t);if(n===void 0)throw new Error(`Vessel ${t} not found`);const s=await this.sendRequest("VESSEL_ADD_PORTION",{handle:n,portion:e});return await this.fetchSnapshot(t),s}async control(t,e){const n=this.vesselHandles.get(t);if(n===void 0)throw new Error(`Vessel ${t} not found`);return this.sendRequest("VESSEL_CONTROL",{handle:n,controls:e})}async step(t,e){const n=this.vesselHandles.get(t);if(n===void 0)throw new Error(`Vessel ${t} not found`);const s=await this.sendRequest("VESSEL_STEP",{handle:n,dt_s:e});return await this.fetchSnapshot(t),s}async equilibrate(t,e=60){const n=this.vesselHandles.get(t);if(n===void 0)throw new Error(`Vessel ${t} not found`);const s=await this.sendRequest("VESSEL_EQUILIBRATE",{handle:n,max_sim_s:e});return await this.fetchSnapshot(t),s}async fetchSnapshot(t){const e=this.vesselHandles.get(t);if(e===void 0)return null;const n=await this.sendRequest("VESSEL_SNAPSHOT",{handle:e});return this.onSnapshotUpdated&&this.onSnapshotUpdated(t,n),n}async registerCustomCompound(t){return this.sendRequest("REGISTER_COMPOUND",t)}async registerCustomReaction(t){return this.sendRequest("REGISTER_REACTION",t)}startSimulationClock(){let t=performance.now();this.simIntervalId=setInterval(async()=>{const e=performance.now(),n=(e-t)/1e3;if(t=e,this.isPaused||this.activeVesselIds.length===0)return;const s=n*this.speedMultiplier,r=this.activeVesselIds.map(o=>this.vesselHandles.get(o)).filter(o=>o!==void 0);if(r.length>0)try{const o=await this.sendRequest("STEP_ALL",{handles:r,dt_s:Math.min(s,1)});for(const a of this.activeVesselIds){const l=this.vesselHandles.get(a);l!==void 0&&o[String(l)]&&this.onSnapshotUpdated&&this.onSnapshotUpdated(a,o[String(l)])}}catch{}},50)}dispose(){this.simIntervalId&&clearInterval(this.simIntervalId)}}function sd(i){const t=i.split(".").filter(Boolean);let e=0;const n=[];for(const r of t){if(r==="O"||r==="[OH2]"){e+=1;continue}let o=0;if(r.includes("+")){const l=r.match(/\+(\d*)/);o=l&&l[1]?parseInt(l[1],10):1}else if(r.includes("-")){const l=r.match(/-(\d*)/);o=l&&l[1]?-parseInt(l[1],10):-1}let a=r.replace(/[\[\]\+\-0-9]/g,"");r.includes("Na")?a="Na+":r.includes("Cl")?a="Cl-":r.includes("K")?a="K+":r.includes("Ca")?a="Ca+2":r.includes("Cu")?a="Cu+2":r.includes("Fe")?a=o===3?"Fe+3":"Fe+2":r.includes("SO4")||r.includes("S(=O)(=O)")?a="SO4-2":r.includes("NO3")?a="NO3-":r.includes("CO3")||r.includes("C(=O)")?a="CO3-2":r.includes("OH")?a="OH-":a=r,n.push({fragmentSmiles:r,formula:a,charge:o})}const s={};for(const r of n)s[r.formula]?s[r.formula].stoichiometry+=1:s[r.formula]={...r,stoichiometry:1};return e>0&&(s.H2O={fragmentSmiles:"O",formula:"H2O",charge:0,stoichiometry:e}),{originalSmiles:i,isHydrate:e>0,waterHydrateNumber:e,components:Object.values(s)}}const Sx="ReactionChamberDB",wx=1;let Rs=null,ts=null;const Ps=new Map,Ls=new Map;function Is(){if(ts)try{ts.close()}catch{}ts=null,Rs=null}function Ex(){return typeof indexedDB>"u"?Promise.reject(new Error("IndexedDB not available")):ts?Promise.resolve(ts):Rs||(Rs=new Promise((i,t)=>{try{const e=indexedDB.open(Sx,wx);e.onupgradeneeded=()=>{const n=e.result;n.objectStoreNames.contains("compounds")||n.createObjectStore("compounds",{keyPath:"inchi_key"}),n.objectStoreNames.contains("bench_state")||n.createObjectStore("bench_state",{keyPath:"id"}),n.objectStoreNames.contains("user_overrides")||n.createObjectStore("user_overrides",{keyPath:"inchi_key"})},e.onsuccess=()=>{const n=e.result;ts=n,n.onclose=()=>{Is()},n.onversionchange=()=>{Is()},i(n)},e.onerror=()=>{const n=e.error||new Error("Failed to open IndexedDB");Is(),t(n)},e.onblocked=()=>{console.warn("[IndexedDB] Database open blocked by another connection")}}catch(e){Is(),t(e)}}),Rs)}async function ar(i,t,e,n=!1){const s=await Ex();return new Promise((r,o)=>{let a;try{a=s.transaction(i,t)}catch(h){const u=h?.message||String(h);return!n&&(u.includes("closing")||u.includes("closed")||h?.name==="InvalidStateError")?(console.warn("[IndexedDB] Connection closing or invalid state. Reopening and retrying transaction..."),Is(),r(ar(i,t,e,!0))):o(h)}const l=a.objectStore(i);let c;a.oncomplete=()=>r(c),a.onerror=()=>{const h=a.error||new Error("IndexedDB transaction error");o(h)},a.onabort=()=>{const h=a.error||new Error("IndexedDB transaction aborted");o(h)};try{const h=e(l,a);h&&typeof h.then=="function"?h.then(u=>{c=u}).catch(u=>{try{a.abort()}catch{}o(u)}):c=h}catch(h){try{a.abort()}catch{}o(h)}})}async function Nh(i){if(!(!i||!i.inchi_key)){Ps.set(i.inchi_key,i);try{await ar("compounds","readwrite",t=>{t.put(i)})}catch(t){console.warn("[IndexedDB] Failed to cache compound in IndexedDB (using memory cache):",t)}}}async function Tx(i){if(!i)return null;if(Ps.has(i))return Ps.get(i);try{const t=await ar("compounds","readonly",e=>new Promise((n,s)=>{const r=e.get(i);r.onsuccess=()=>n(r.result||null),r.onerror=()=>s(r.error)}));return t&&Ps.set(i,t),t}catch(t){return console.warn("[IndexedDB] Failed to get cached compound from IndexedDB:",t),Ps.get(i)||null}}async function Ax(i,t){if(i){Ls.set(i,t);try{await ar("user_overrides","readwrite",e=>{e.put({inchi_key:i,overrides:t,updatedAt:Date.now()})})}catch(e){console.warn("[IndexedDB] Failed to save user overrides in IndexedDB:",e)}}}async function Cx(i){if(!i)return null;if(Ls.has(i))return Ls.get(i)||null;try{const t=await ar("user_overrides","readonly",e=>new Promise((n,s)=>{const r=e.get(i);r.onsuccess=()=>n(r.result?r.result.overrides:null),r.onerror=()=>s(r.error)}));return t&&Ls.set(i,t),t}catch(t){return console.warn("[IndexedDB] Failed to get user overrides from IndexedDB:",t),Ls.get(i)||null}}let ws=null;async function Eo(){if(ws)return ws;try{const i=await fetch("/data/bundle.json");if(i.ok)return ws=(await i.json()).species||{},console.log(`[DataBundle] Loaded ${Object.keys(ws||{}).length} bundle species.`),ws||{}}catch(i){console.warn("[DataBundle] Failed to fetch bundle.json, running standalone:",i)}return{}}class Rx{queue=[];processing=!1;minIntervalMs=210;push(t){return new Promise((e,n)=>{this.queue.push(async()=>{try{const s=await t();e(s)}catch(s){n(s)}}),this.process()})}async process(){if(!(this.processing||this.queue.length===0)){for(this.processing=!0;this.queue.length>0;){const t=this.queue.shift();t&&(await t(),await new Promise(e=>setTimeout(e,this.minIntervalMs)))}this.processing=!1}}}const Px=new Rx;async function Lx(i){const t=i.trim();if(!t)return[];const e=await Eo(),n=[],s=t.toLowerCase();for(const r of Object.values(e))if((r.name.toLowerCase().includes(s)||r.formula.toLowerCase().includes(s))&&(n.push(r.name),n.length>=6))break;try{const r=`https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound/${encodeURIComponent(t)}/json?limit=6`,o=await fetch(r);if(o.ok){const l=(await o.json())?.dictionary_terms?.compound||[];return Array.from(new Set([...n,...l])).slice(0,8)}}catch{}return n.slice(0,8)}async function Ix(i){const t=i.trim(),e=await Eo(),n=Object.values(e).find(s=>s.name.toLowerCase()===t.toLowerCase()||s.cid&&String(s.cid)===t);if(n)try{const s=await Tx(n.inchi_key);if(s)return s}catch{}try{return await Px.push(async()=>{const r=`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(t)}/property/Title,IUPACName,MolecularFormula,MolecularWeight,CanonicalSMILES,InChIKey,Charge/JSON`,o=await fetch(r);if(!o.ok)throw new Error(`PubChem returned ${o.status}`);const l=(await o.json())?.PropertyTable?.Properties?.[0];if(!l)throw new Error("Compound not found in PubChem");const c=l.CanonicalSMILES||"",h=l.InChIKey||"",u=sd(c);let d=n?n.mp_c:20,f=n?n.bp_c:100,g=n?n.density:1,_=n?n.ghs:[],m=n?.physical_state,p=n?.color;try{const M=`https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${l.CID}/JSON`,v=await fetch(M);if(v.ok){const A=await v.json(),E=JSON.stringify(A),R=fx(E);R.length>0&&(_=R);const P=px(A,["Physical Description","Color/Form","Melting Point","Boiling Point","Density"]),b=[...P["Physical Description"]??[],...P["Color/Form"]??[]];if(m=m??mx(b),p=p??vx(b),!n){const y=F=>(P[F]??[]).map(U=>ux(U)).filter(U=>!!U),I=(P.Density??[]).map(F=>dx(F)).filter(F=>!!F);d=_a(y("Melting Point"),d),f=_a(y("Boiling Point"),f),g=_a(I,g)}}}catch{}const x={inchi_key:h,cid:l.CID,name:l.Title||t,formula:l.MolecularFormula||"",smiles:c,charge:l.Charge||0,mw:parseFloat(l.MolecularWeight)||0,mp_c:d,bp_c:f,density:g,solubility:n?n.solubility:"soluble",ghs:_,tier:"tabulated",source:"PubChem PUG REST",physical_state:m,color:p};try{await Nh(x)}catch{}return x})}catch{if(n){try{await Nh(n)}catch{}return n}throw new Error(`Could not find or import "${t}".`)}}function ho(i,t){try{const e=window.localStorage.getItem(i);return e===null?t:JSON.parse(e)}catch{return t}}function Vs(i,t){try{window.localStorage.setItem(i,JSON.stringify(t))}catch{}}const ba=[{id:"all",label:"All"},{id:"solution",label:"Solutions"},{id:"liquid",label:"Liquids"},{id:"solid",label:"Solids"},{id:"indicator",label:"Indicators"},{id:"imported",label:"Imported"}],Oh="rc.recent.v1",Sa="rc.imported.v1",Dx=24,Fh=200,Ux="#e8f4fa";class Nx{catalog=[];imported=[];recent=[];items=new Map;ordered=[];hay=new Map;onChange;constructor(){this.recent=ho(Oh,[]).filter(e=>typeof e=="string");const t=ho(Sa,[]);this.imported=Array.isArray(t)?t.filter(e=>e&&typeof e.id=="string"):[],this.rebuild()}setCatalog(t){this.catalog=t.slice(),this.rebuild()}catalogEntries(){return this.catalog}importedBottles(){return this.imported}addImported(t){const e=this.imported.find(n=>n.inchi_key&&n.inchi_key===t.inchi_key);return e?this.items.get(`pc:${e.id}`):(this.imported.unshift(t),this.imported.length>Fh&&(this.imported.length=Fh),Vs(Sa,this.imported),this.rebuild(),this.items.get(`pc:${t.id}`))}persistImported(){Vs(Sa,this.imported)}markUsed(t){this.recent=[t,...this.recent.filter(e=>e!==t)].slice(0,Dx),Vs(Oh,this.recent),this.onChange?.()}rebuild(){this.items.clear(),this.hay.clear(),this.ordered=[];for(const t of this.catalog){const e={kind:"catalog",key:`cat:${t.id}`,id:t.id,entry:t};this.items.set(e.key,e),this.ordered.push(e)}for(const t of this.imported){const e={kind:"imported",key:`pc:${t.id}`,id:t.id,bottle:t};this.items.set(e.key,e),this.ordered.push(e)}this.onChange?.()}get(t){return this.items.get(t)}findByShelfId(t){return this.items.get(`cat:${t}`)??this.items.get(`pc:${t}`)}recentItems(){return this.recent.map(t=>this.items.get(t)).filter(t=>!!t)}get size(){return this.ordered.length}catalogMatchFor(t){const e=Bh(t.formula);if(e)return this.catalog.find(n=>Bh(n.formula)===e)}matchesFilter(t,e){if(e==="all")return!0;if(e==="imported")return t.kind==="imported";if(t.kind!=="catalog")return!1;const n=t.entry;return e==="indicator"?!!n.dropper:e==="solid"?n.form==="solid"||n.by_mass:e==="liquid"?n.form==="liquid"&&!n.dropper:e==="solution"?n.form==="solution"&&!n.dropper:!0}search(t,e,n){const s=t.trim().toLowerCase(),r=s.split(/\s+/).filter(Boolean),o=[];return this.ordered.forEach((a,l)=>{if(!this.matchesFilter(a,e))return;if(r.length===0){o.push({it:a,s:0,i:l});return}const c=this.haystack(a);if(!r.every(f=>c.includes(f)))return;const h=tr(a).toLowerCase(),u=Gl(a).toLowerCase();let d=5;u===s?d=0:h.startsWith(s)?d=1:h.includes(` ${s}`)||h.includes(`(${s}`)?d=2:u.startsWith(s)?d=3:h.includes(s)&&(d=4),o.push({it:a,s:d,i:l})}),o.sort((a,l)=>a.s-l.s||a.i-l.i),{items:o.slice(0,n).map(a=>a.it),total:o.length}}haystack(t){let e=this.hay.get(t.key);return e===void 0&&(e=t.kind==="catalog"?`${t.entry.name} ${t.entry.formula} ${t.entry.id} ${t.entry.label}`.toLowerCase():`${t.bottle.name} ${t.bottle.formula} ${t.bottle.cid??""}`.toLowerCase(),this.hay.set(t.key,e)),e}}function Bh(i){return(i||"").replace(/\s+/g,"").toLowerCase()}function Gl(i){return i.kind==="catalog"?i.entry.formula:i.bottle.formula}function tr(i){const t=i.kind==="catalog"?i.entry.name:i.bottle.name;return t.replace(/\s*\((dropper|powder|solid|liquid)\)\s*$/i,"").replace(/\s+\d[\d.]*\s*(M|%)(\s*\([^)]*\))?\s*$/i,"").trim()||t}function Gs(i){return i.kind==="imported"?Vl(i.bottle)?"g":"ml":i.entry.dropper?"drops":i.entry.by_mass?"g":"ml"}function rd(i){if(i.kind==="imported")return Vl(i.bottle)?"imported solid · visual only":"imported · visual only";const t=i.entry,e=t.name.match(/(\d[\d.]*\s*%)/);if(t.dropper)return e?`${e[1]} · drops`:"dropper";if(t.by_mass||t.form==="solid")return"solid";if(t.form==="liquid")return e?`${e[1]} liquid`:"liquid";if(t.concentration_m!==void 0&&t.concentration_m!==null){const n=t.concentration_m;return`${n>=1?n.toFixed(1):n.toPrecision(2)} M`}return e?e[1]:"solution"}const Ox={GHS01:"Explosive",GHS02:"Flammable",GHS03:"Oxidiser",GHS04:"Gas under pressure",GHS05:"Corrosive",GHS06:"Toxic",GHS07:"Harmful / irritant",GHS08:"Health hazard",GHS09:"Environmental hazard"};function od(i){return(i??[]).map(t=>Ox[t]??t)}function ad(i){return i.kind==="catalog"?i.entry.signal_word:i.bottle.ghs&&i.bottle.ghs.length>0?"Warning":""}function Fx(i){return i.kind==="catalog"?i.entry.ghs:i.bottle.ghs}function Bx(i){return i.kind==="catalog"?i.entry.bottle_colour:"custom"}function kx(i){return i.kind==="imported"&&/^#[0-9a-f]{6}$/i.test(i.bottle.color)?i.bottle.color:Ux}function kh(i){const t=new St(i);return[t.r,t.g,t.b]}const zh=(i,t,e)=>{const n=Math.min(1,Math.max(0,(e-i)/(t-i)));return n*n*(3-2*n)};function zx(i,t=3){const e=i.map(s=>-Math.log10(Math.min(1,Math.max(.02,s)))/t),n=[];for(let s=0;s<xl;s++){const r=pM+mM*s,o=1-zh(470,530,r),a=zh(560,620,r),l=Math.max(0,1-Math.abs(r-545)/65),c=o+l+a||1;n.push((a*e[0]+l*e[1]+o*e[2])/c)}return n}const Hx=.2;class Vx{items=new Map;lastT=new Map;has(t){return(this.items.get(t)?.length??0)>0}clear(t){this.items.delete(t),this.lastT.delete(t)}add(t,e){this.put(t,[e])}put(t,e){if(e.length===0)return;const n=this.items.get(t)??[];for(const s of e){const r=n.find(o=>o.key===s.key&&o.kind===s.kind&&!!o.ghost==!!s.ghost);if(r){const o=r.mass_g,a=s.mass_g;if(o+a>0)for(let l=0;l<3;l++)r.rgb[l]=(r.rgb[l]*o+s.rgb[l]*a)/(o+a);r.mass_g+=s.mass_g,r.volume_ml+=s.volume_ml}else n.push({...s,rgb:[...s.rgb]})}this.items.set(t,n)}take(t,e){const n=this.items.get(t);if(!n||n.length===0)return[];const s=Math.min(1,Math.max(0,e)),r=[];for(const o of n)r.push({...o,rgb:[...o.rgb],mass_g:o.mass_g*s,volume_ml:o.volume_ml*s}),o.mass_g*=1-s,o.volume_ml*=1-s;return this.items.set(t,n.filter(o=>o.mass_g>1e-5||o.volume_ml>1e-4)),r}apply(t,e,n){const s=this.items.get(t);if(!s||s.length===0)return this.lastT.set(t,e.t_sim_s),e;const r=Math.max(0,Math.min(5,e.t_sim_s-(this.lastT.get(t)??e.t_sim_s)));this.lastT.set(t,e.t_sim_s);const o=e.layers.map(f=>({...f}));let a=e.total_liquid_ml,l=0;const c=e.solids.slice(),h=e.species.slice();for(const f of s){if(f.kind!=="liquid"||f.volume_ml<=1e-4)continue;const g=zx(f.rgb),_=o.find(p=>p.phase==="aqueous");if(_){const p=_.volume_ml,x=f.volume_ml;_.absorbance_per_cm=_.absorbance_per_cm.map((M,v)=>(M*p+g[v]*x)/(p+x)),_.scatter_per_cm=_.scatter_per_cm*p/(p+x),_.volume_ml=p+x}else o.unshift({phase:"aqueous",volume_ml:f.volume_ml,density_g_ml:f.density_g_ml,refractive_index:1.333,absorbance_per_cm:g,scatter_per_cm:0,scatter_rgb:[1,1,1]});a+=f.volume_ml;const m=f.volume_ml*f.density_g_ml;l+=m,h.push(Hh(f,m,f.mw||60,"aqueous",a))}const u=a>.5,d=Hx*(n?3:1);for(const f of s){if(f.kind!=="solid")continue;let g=f.mass_g;if(f.ghost){u&&r>0&&g>0&&(g=Math.pow(Math.max(0,Math.cbrt(g)-d*r/3),3)),f.mass_g=g;const m=e.solids.filter(p=>f.ghost.species.includes(p.species)).reduce((p,x)=>p+x.mass_g,0);g=Math.max(0,g-m)}else l+=g,h.push(Hh(f,g,f.mw||100,"solid",a));if(g<=1e-5)continue;const _=Math.min(25,Math.max(.3,f.density_g_ml||1.5));c.push({species:f.ghost?`ghost:${f.key}`:f.key,name:f.name,mass_g:g,settled_volume_ml:g/_*1.6,suspended_fraction:u?.1:0,particle_diameter_um:30,rgb:f.rgb,kind:"powder",remaining_fraction:1})}return this.items.set(t,s.filter(f=>f.kind==="liquid"?f.volume_ml>1e-4:f.mass_g>1e-5)),{...e,layers:o,total_liquid_ml:a,solids:c,species:h,contents_mass_g:e.contents_mass_g+l}}}function Hh(i,t,e,n,s){const r=t/Math.max(1,e);return{id:i.key,name:i.name,formula:i.formula||i.name,charge:0,phase:n,amount_mol:r,conc_m:n==="solid"||s<=.01?null:r/(s/1e3),activity:null,tier:"speculative"}}const ld="rc.reagentColors.v1",Vh=6,eo=new Map(Object.entries(ho(ld,{}))),wa=new Map;let Gh=Promise.resolve(),Gx=0;function Wh(i,t,e){return"#"+new St().setRGB(Math.min(1,Math.max(0,i)),Math.min(1,Math.max(0,t)),Math.min(1,Math.max(0,e)),ii).getHexString(we)}function Wx(i,t){const e=i.solids.find(l=>l.mass_g>1e-6);if(i.total_liquid_ml<=.01)return e?Wh(e.rgb[0],e.rgb[1],e.rgb[2]):null;const n=i.layers[i.layers.length-1];if(!n)return null;const[s,r,o]=$u(t,n.absorbance_per_cm,Vh),a=Math.exp(-n.scatter_per_cm*Vh);return Wh(s*a+n.scatter_rgb[0]*(1-a),r*a+n.scatter_rgb[1]*(1-a),o*a+n.scatter_rgb[2]*(1-a))}function qx(i){return i.by_mass?{reagent_id:i.id,mass_g:2}:{reagent_id:i.id,volume_ml:50}}function cd(i){return eo.get(i)}function Yx(i,t,e){const n=eo.get(t.id);if(n)return Promise.resolve(n);if(!e)return Promise.resolve(null);const s=wa.get(t.id);if(s)return s;const r=Gh.then(async()=>{const o=`__colour_probe_${++Gx}`;try{await i.createVessel(o,{type:"beaker-250",capacity_ml:250,glass_mass_g:110,inner_radius_cm:3.5}),await i.dose(o,qx(t));const a=await i.fetchSnapshot(o),l=a?Wx(a,e):null;return l&&(eo.set(t.id,l),Vs(ld,Object.fromEntries(eo))),l}catch{return null}finally{i.freeVessel(o).catch(()=>{}),wa.delete(t.id)}});return Gh=r.catch(()=>null),wa.set(t.id,r),r}const bl=[{type:"beaker-50",label:"Beaker 50 mL",capacityMl:50,icon:"beaker",glassMassG:35,innerRadiusCm:2},{type:"beaker-250",label:"Beaker 250 mL",capacityMl:250,icon:"beaker",glassMassG:110,innerRadiusCm:3.5},{type:"beaker-1000",label:"Beaker 1 L",capacityMl:1e3,icon:"beaker",glassMassG:320,innerRadiusCm:5.5},{type:"erlenmeyer-250",label:"Flask 250 mL",capacityMl:250,icon:"erlenmeyer",glassMassG:130,innerRadiusCm:4},{type:"cylinder-100",label:"Cylinder 100 mL",capacityMl:100,icon:"cylinder",glassMassG:140,innerRadiusCm:1.5},{type:"test-tube",label:"Test tube",capacityMl:30,icon:"testTube",glassMassG:20,innerRadiusCm:.9}];function hd(i){return bl.find(t=>t.type===i)??bl[1]}const Xx=.05,qh=400,$x=2e4;class To{constructor(t,e){this.bench=t,this.sim=e}vessels=new Map;controls=new Map;latest=new Map;flammableAdded=new Set;visual=new Vx;nextId=1;typeCounters=new Map;hotPlateId=null;selectedId=null;onVesselsChanged;onSelectionChanged;onControlsChanged;list(){return Array.from(this.vessels.values())}get(t){return this.vessels.get(t)}has(t){return this.vessels.has(t)}ctl(t){let e=this.controls.get(t);return e||(e={heaterW:0,stirring:!1,stirRpm:0,iceBath:!1},this.controls.set(t,e)),e}snapshot(t){return this.latest.get(t)}isOnHotPlate(t){return(this.bench.getHotPlateVesselId()??this.hotPlateId)===t}freeCapacityMl(t){const e=this.vessels.get(t);if(!e)return 0;const n=this.latest.get(t),s=n?n.total_liquid_ml:e.currentVolumeMl;return Math.max(0,e.capacityMl-s)}volumeMl(t){const e=this.latest.get(t);return e?e.total_liquid_ml:this.vessels.get(t)?.currentVolumeMl??0}hasFlammable(t){const e=this.latest.get(t);return!e||e.total_liquid_ml<=.01?!1:e.layers.some(n=>n.phase==="organic")||e.species.some(n=>n.phase==="organic"&&n.amount_mol>1e-6)?!0:this.flammableAdded.has(t)}ingest(t,e){const n=this.vessels.get(t);if(!n)return null;const s=this.visual.apply(t,e,this.ctl(t).stirring);this.latest.set(t,s),n.currentVolumeMl=s.total_liquid_ml,n.temperatureK=s.temperature_k,n.ph=s.ph!==null?s.ph:void 0;const r=n.isSealed!==s.sealed;return n.isSealed=s.sealed,n.contents=s.species.map(o=>({name:o.name,formula:o.formula,amountMol:o.amount_mol,concentrationM:o.conc_m!==null?o.conc_m:0})),r&&t===this.selectedId&&this.bench.setSelectedVessel(t),s}async spawn(t){const e=hd(t),n=(this.typeCounters.get(t)??0)+1;this.typeCounters.set(t,n);const s={id:`vessel_${this.nextId++}`,name:n>1?`${e.label} (${n})`:e.label,type:t,capacityMl:e.capacityMl,currentVolumeMl:0,liquidColor:"#e8f4fa",liquidOpacity:.6,temperatureK:298.15,isSealed:!1,stirring:!1,contents:[]},o=this.bench.addVessel(s)?.vesselState??s;this.vessels.set(s.id,o),this.ctl(s.id);const a={type:t,capacity_ml:e.capacityMl,glass_mass_g:e.glassMassG,inner_radius_cm:e.innerRadiusCm,temperature_k:298.15,room_k:295.15,sealed:!1,stopper_pop_atm:2.2,burst_atm:6};return await this.sim.createVessel(s.id,a),this.onVesselsChanged?.(),o}async remove(t){if(this.vessels.has(t)){this.isOnHotPlate(t)&&(this.bench.placeVesselOnHotPlate(null),this.hotPlateId=null,this.bench.instruments?.hotPlate?.setPower(0),this.bench.instruments?.hotPlate?.setStir(!1,0)),this.vessels.delete(t),this.controls.delete(t),this.latest.delete(t),this.flammableAdded.delete(t),this.visual.clear(t);try{await this.sim.freeVessel(t)}finally{if(this.bench.removeVessel(t),this.selectedId===t){const e=this.list()[0]?.id??null;this.select(e)}this.onVesselsChanged?.()}}}select(t){t!==null&&!this.vessels.has(t)||(this.selectedId=t,this.bench.setSelectedVessel(t),this.onSelectionChanged?.(t))}moveToHotPlate(t){if(this.isOnHotPlate(t)){this.hotPlateId=t;return}const n=this.bench.placeVesselOnHotPlate(t)??(this.hotPlateId!==t?this.hotPlateId:null);if(this.hotPlateId=t,n&&n!==t&&this.vessels.has(n)){const s=this.ctl(n);s.heaterW=0,s.stirring=!1,s.stirRpm=0,this.sim.control(n,{heater_w:0,stirring:!1,stir_rpm:0}).catch(()=>{}),this.bench.getGlassware(n)?.setStirring(0);const r=this.vessels.get(n);r&&(r.stirring=!1),this.onControlsChanged?.(n)}this.syncHotPlate(t)}syncHotPlate(t){const e=this.ctl(t),n=this.bench.instruments?.hotPlate;n?.setPower(e.heaterW),n?.setStir(e.stirring,e.stirring?e.stirRpm||qh:0)}async setHeat(t,e){const n=this.ctl(t),s=Math.max(0,Math.min(1e3,Math.round(e)));(s>0||this.isOnHotPlate(t))&&this.moveToHotPlate(t),n.heaterW=s,this.isOnHotPlate(t)&&this.bench.instruments?.hotPlate?.setPower(s),await this.sim.control(t,{heater_w:s})}async setStir(t,e){const n=this.ctl(t);e&&this.moveToHotPlate(t),n.stirring=e,n.stirRpm=e?qh:0;const s=this.vessels.get(t);s&&(s.stirring=e),this.isOnHotPlate(t)&&this.bench.instruments?.hotPlate?.setStir(e,n.stirRpm),this.bench.getGlassware(t)?.setStirring(n.stirRpm),await this.sim.control(t,{stirring:e,stir_rpm:n.stirRpm})}async setIceBath(t,e){this.ctl(t).iceBath=e,await this.sim.control(t,{bath_k:e?273.15:null})}async setSealed(t,e){const n=this.vessels.get(t);n&&(n.isSealed=e),await this.sim.control(t,{sealed:e}),t===this.selectedId&&this.bench.setSelectedVessel(t)}async ignite(t){await this.sim.control(t,{igniter:!0}),await new Promise(e=>window.setTimeout(e,450)),this.vessels.has(t)&&await this.sim.control(t,{igniter:!1})}static addedVolumeMl(t,e){const n=Gs(t);return n==="drops"?e*Xx:n==="g"?0:e}async addReagent(t,e,n){if(!this.vessels.has(e))throw new Error("That vessel is no longer on the bench.");if(!(n>0))throw new Error("Enter an amount greater than zero.");const s=To.addedVolumeMl(t,n),r=this.freeCapacityMl(e);if(s>r+1e-6)throw new Error(`Only ${r.toFixed(1)} mL of space left.`);const o=kx(t);if(t.kind==="imported"){const c=t.bottle,h=Gs(t);if(await this.animate(g=>{h==="g"?this.bench.animateSolidAddition(t.id,e,o,g):this.bench.animatePour(t.id,e,o,g)}),!this.vessels.has(e))throw new Error("That vessel was removed before the addition finished.");const u=c.userOverrides?.density??c.sourcedProperties?.density,d=typeof u=="number"&&isFinite(u)&&u>.05&&u<25?u:h==="g"?1.6:1,f={key:c.id,name:c.name,formula:c.formula,kind:h==="g"?"solid":"liquid",rgb:kh(/^#[0-9a-f]{6}$/i.test(c.color)?c.color:h==="g"?"#f4f3ef":"#e8f4fa"),mass_g:h==="g"?n:0,volume_ml:h==="g"?0:n,density_g_ml:d,mw:c.mw||0};return this.visual.add(e,f),await this.sim.fetchSnapshot(e),"visual"}const a=t.entry,l=Gs(t);if(await this.animate(c=>{l==="drops"?this.bench.animateDrops(a.id,e,Math.round(n),o,c):l==="g"?this.bench.animateSolidAddition(a.id,e,o,c):this.bench.animatePour(a.id,e,o,c)}),!this.vessels.has(e))throw new Error("That vessel was removed before the addition finished.");return l==="drops"?await this.sim.dose(e,{reagent_id:a.id,drops:Math.round(n)}):l==="g"?(Ju(a.formula,a.name)||this.visual.add(e,{key:a.id,name:a.name,formula:a.formula,kind:"solid",rgb:kh(cd(a.id)??"#f4f3ef"),mass_g:n,volume_ml:0,density_g_ml:a.density_g_ml||1.6,mw:0,ghost:{species:Object.keys(a.composition)}}),await this.sim.dose(e,{reagent_id:a.id,mass_g:n})):await this.sim.dose(e,{reagent_id:a.id,volume_ml:n}),a.ghs.includes("GHS02")&&this.flammableAdded.add(e),"dosed"}maxPourMl(t,e){return Math.max(0,Math.min(this.volumeMl(t),this.freeCapacityMl(e)))}async pour(t,e,n){if(!this.vessels.has(t)||!this.vessels.has(e))throw new Error("Pick two vessels on the bench.");const s=Math.min(n,this.maxPourMl(t,e));if(!(s>.01))throw new Error("Nothing to pour, or the target is full.");let r="#e8f4fa";try{r=this.bench.getGlassware(t)?.getLiquidColorHex()||r}catch{}const o=this.volumeMl(t),a=await this.sim.removeLiquid(t,s,!0),l=this.visual.take(t,o>0?s/o:1);this.flammableAdded.has(t)&&this.flammableAdded.add(e),await this.animate(c=>this.bench.animatePour(t,e,r,c)),this.vessels.has(e)&&(this.visual.put(e,l),await this.sim.addPortion(e,a))}async empty(t){this.vessels.has(t)&&(await this.sim.removeLiquid(t,1e5,!0),this.visual.clear(t),this.flammableAdded.delete(t),await this.sim.fetchSnapshot(t))}animate(t){return new Promise(e=>{let n=!1;const s=()=>{n||(n=!0,e())};window.setTimeout(s,$x);try{t(s)}catch(r){console.warn("[Lab] animation failed",r),s()}})}}function q(i,t={},...e){const n=document.createElement(i);for(const[s,r]of Object.entries(t))r==null||r===!1||(s==="class"?n.className=String(r):s==="text"?n.textContent=String(r):s==="html"?n.innerHTML=String(r):r===!0?n.setAttribute(s,""):n.setAttribute(s,String(r)));for(const s of e)s==null||s===!1||n.append(typeof s=="string"?document.createTextNode(s):s);return n}function Ie(i){return i.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function Le(i,t){i.textContent!==t&&(i.textContent=t)}const jx={0:"₀",1:"₁",2:"₂",3:"₃",4:"₄",5:"₅",6:"₆",7:"₇",8:"₈",9:"₉"},Yh={0:"⁰",1:"¹",2:"²",3:"³",4:"⁴",5:"⁵",6:"⁶",7:"⁷",8:"⁸",9:"⁹","+":"⁺","-":"⁻"};function ls(i){if(!i)return"";let t=i,e="";const n=t.match(/\((s|l|g|aq)\)$/);n&&(e=n[0],t=t.slice(0,-e.length));let s="";const r=t.match(/([+-])(\d*)$/);return r&&t.length>r[0].length&&/[A-Za-z0-9)\]]/.test(t[t.length-r[0].length-1])&&(s=(r[2]&&r[2]!=="1"?r[2]:"").split("").map(a=>Yh[a]).join("")+Yh[r[1]],t=t.slice(0,-r[0].length)),t=t.replace(/([A-Za-z)\]])(\d+)/g,(o,a,l)=>a+l.split("").map(c=>jx[c]).join("")),t+s+e}function Kx(i){const t=Math.abs(i);return t>=.1?`${i.toFixed(2)} M`:t>=1e-4?`${(i*1e3).toPrecision(3)} mM`:t>=1e-7?`${(i*1e6).toPrecision(3)} µM`:`${i.toExponential(1)} M`}function Zx(i){const t=Math.abs(i);return t>=.1?`${i.toFixed(2)} mol`:t>=1e-4?`${(i*1e3).toPrecision(3)} mmol`:`${(i*1e6).toPrecision(3)} µmol`}function ud(i){const t=Math.max(0,i),e=Math.floor(t/60),n=t-e*60;return`${String(e).padStart(2,"0")}:${n.toFixed(1).padStart(4,"0")}`}function Xh(i){if(!(i instanceof HTMLElement))return!1;const t=i.tagName;if(i.isContentEditable||t==="TEXTAREA"||t==="SELECT")return!0;if(t==="INPUT"){const e=i.type;return!["button","checkbox","radio","range","submit","reset"].includes(e)}return!1}const Jx={search:'<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',close:'<path d="M6 6l12 12M18 6L6 18"/>',chevronDown:'<path d="M6 9l6 6 6-6"/>',chevronUp:'<path d="M6 15l6-6 6 6"/>',more:'<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',details:'<path d="M4 19h16"/><path d="M4 15l4-5 4 3 5-7 3 4"/>',focus:'<path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/><circle cx="12" cy="12" r="2.5"/>',trash:'<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>',play:'<path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none"/>',pause:'<path d="M8 5v14M16 5v14" stroke-width="3"/>',flame:'<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 01-10 0c0-2.5 1.4-3.8 2.4-5 .3 1.6 1 2.6 2 3 0-3 0-5.5.6-8z"/>',heat:'<path d="M8 4c-1.5 2 1.5 3.5 0 6M12 4c-1.5 2 1.5 3.5 0 6M16 4c-1.5 2 1.5 3.5 0 6"/><rect x="4" y="13" width="16" height="4" rx="1"/><path d="M6 20h12"/>',stir:'<path d="M20 12a8 8 0 11-2.3-5.6"/><path d="M20 4v4.5h-4.5"/><rect x="9" y="11" width="6" height="2" rx="1" fill="currentColor"/>',ice:'<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.5 4.5L12 6l2.5-1.5M9.5 19.5L12 18l2.5 1.5"/>',stopper:'<path d="M8 4h8l-1 7H9z"/><path d="M7 13h10v7a1 1 0 01-1 1H8a1 1 0 01-1-1z"/>',pour:'<path d="M4 7l6-3 2 4-6 3z"/><path d="M11 8c2 2 2 5 2 7"/><path d="M8 15h10l-1 6H9z"/>',drop:'<path d="M12 3.5c3 4 5.5 6.8 5.5 10a5.5 5.5 0 01-11 0c0-3.2 2.5-6 5.5-10z"/>',scoop:'<path d="M3 20l8-8"/><path d="M11 12c1-3 4-6 7-6 1 0 2 1 2 2 0 3-3 6-6 7z"/>',plus:'<path d="M12 5v14M5 12h14"/>',info:'<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.01"/>',warning:'<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.01"/>',check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',cloud:'<path d="M7 18h10a4 4 0 00.5-8A6 6 0 006 9.5 4.3 4.3 0 007 18z"/><path d="M12 10.5v6M9.5 14l2.5 2.5 2.5-2.5"/>',list:'<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>',bucket:'<path d="M5 8h14l-1.5 12h-11z"/><path d="M8 8a4 4 0 018 0"/>',spark:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>',test:'<path d="M9 3h6M10 3v6l-5 9a2 2 0 001.8 3h10.4a2 2 0 001.8-3l-5-9V3"/><path d="M7.5 15h9"/>',beaker:'<path d="M5 4h14M6 4v15a1 1 0 001 1h10a1 1 0 001-1V4"/><path d="M6 12h12" opacity=".45"/>',erlenmeyer:'<path d="M9.5 3h5M10 3v6l-5.5 10a1 1 0 00.9 1.5h13.2a1 1 0 00.9-1.5L14 9V3"/><path d="M7 15h10" opacity=".45"/>',cylinder:'<path d="M8 3h8M9 3v16M15 3v16M6 21h12M9 19h6"/><path d="M9 7h2M9 10h3M9 13h2M9 16h3" opacity=".6"/>',testTube:'<path d="M9 3h6M10 3v14a2 2 0 004 0V3"/><path d="M10 12h4" opacity=".45"/>'};function ee(i,t=18,e=""){return`<svg class="ic ${e}" width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${Jx[i]}</svg>`}class Qx{el;onToggleDetails;detailsBtn;moreBtn;menu;statusDot;engineRow;serverRow;engine={s:"pending",text:"Starting…"};server={s:"pending",text:"Checking…"};constructor(t){this.el=q("header",{class:"topbar"});const e=q("div",{class:"brand"});e.innerHTML='<svg class="brand-mark" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M9.5 3h5M10 3v6l-5.5 10a1 1 0 00.9 1.5h13.2a1 1 0 00.9-1.5L14 9V3"/><path d="M6.6 15.5h10.8" /><circle cx="11" cy="17.6" r=".7" fill="currentColor"/><circle cx="13.6" cy="16.9" r=".5" fill="currentColor"/></svg><span class="brand-name">Reaction Chamber</span>';const n=q("div",{class:"topbar-right"});this.statusDot=q("span",{class:"status-dot",role:"img"}),this.detailsBtn=q("button",{class:"btn btn-bar",type:"button","aria-pressed":"false",title:"Details (A)"}),this.detailsBtn.innerHTML=`${ee("details",16)}<span>Details</span><kbd>A</kbd>`,this.detailsBtn.addEventListener("click",()=>this.onToggleDetails?.()),this.moreBtn=q("button",{class:"icon-btn btn-bar-icon",type:"button","aria-label":"More","aria-haspopup":"menu","aria-expanded":"false","aria-controls":"more-menu",html:ee("more",18)}),this.menu=q("div",{class:"menu",id:"more-menu",role:"menu",hidden:!0,"aria-label":"More"});for(const r of t){const o=q("button",{class:"menu-item",role:"menuitem",type:"button",tabindex:"-1"});o.innerHTML=`${ee(r.icon,16)}<span class="mi-label"></span>`,o.querySelector(".mi-label").textContent=r.label,r.hint&&o.append(q("span",{class:"mi-hint",text:r.hint})),o.addEventListener("click",()=>{this.closeMenu(!1),r.action()}),this.menu.append(o)}this.menu.append(q("div",{class:"menu-sep",role:"separator"})),this.engineRow=q("div",{class:"menu-status"}),this.serverRow=q("div",{class:"menu-status"}),this.menu.append(this.engineRow,this.serverRow),this.moreBtn.addEventListener("click",()=>this.menu.hidden?this.openMenu():this.closeMenu(!0)),this.menu.addEventListener("keydown",r=>this.onMenuKey(r)),document.addEventListener("pointerdown",r=>{!this.menu.hidden&&!this.menu.contains(r.target)&&!this.moreBtn.contains(r.target)&&this.closeMenu(!1)});const s=q("div",{class:"menu-wrap"},this.moreBtn,this.menu);n.append(this.statusDot,this.detailsBtn,s),this.el.append(e,n),this.paintStatus()}setDetailsOpen(t){this.detailsBtn.setAttribute("aria-pressed",String(t))}setEngineStatus(t,e){this.engine={s:t,text:e},this.paintStatus()}setServerStatus(t,e){this.server={s:t,text:e},this.paintStatus()}get menuOpen(){return!this.menu.hidden}closeMenu(t){this.menu.hidden||(this.menu.hidden=!0,this.moreBtn.setAttribute("aria-expanded","false"),t&&this.moreBtn.focus())}openMenu(){this.menu.hidden=!1,this.moreBtn.setAttribute("aria-expanded","true"),this.menu.querySelector(".menu-item")?.focus()}onMenuKey(t){const e=Array.from(this.menu.querySelectorAll(".menu-item")),n=e.indexOf(document.activeElement);if(t.key==="ArrowDown"||t.key==="ArrowUp"){t.preventDefault();const s=e.length;e[(n+(t.key==="ArrowDown"?1:s-1)+s)%s]?.focus()}else t.key==="Home"?(t.preventDefault(),e[0]?.focus()):t.key==="End"?(t.preventDefault(),e[e.length-1]?.focus()):t.key==="Escape"?(t.preventDefault(),t.stopPropagation(),this.closeMenu(!0)):t.key==="Tab"&&this.closeMenu(!1)}paintStatus(){const t=(e,n,s)=>{e.innerHTML="",e.append(q("span",{class:`status-dot is-${s.s}`,"aria-hidden":"true"}),q("span",{class:"ms-name",text:n}),q("span",{class:"ms-val",text:s.text}))};t(this.engineRow,"Chemistry engine",this.engine),t(this.serverRow,"Local server",this.server),this.statusDot.className=`status-dot is-${this.engine.s}`,this.statusDot.setAttribute("aria-label",`Chemistry engine: ${this.engine.text}`),this.statusDot.title=`Chemistry engine: ${this.engine.text} · Local server: ${this.server.text}`}}const ty={ml:'<path d="M9 3h6v3l2 2v12a1 1 0 01-1 1H8a1 1 0 01-1-1V8l2-2z"/><path class="sw-fill" d="M7.6 13h8.8v6.4a.6.6 0 01-.6.6H8.2a.6.6 0 01-.6-.6z"/>',drops:'<path d="M10.5 2.5h3v3h-3z"/><path d="M9.5 5.5h5l1.5 3V20a1 1 0 01-1 1H9a1 1 0 01-1-1V8.5z"/><path class="sw-fill" d="M8.6 14h6.8v5.4a.6.6 0 01-.6.6H9.2a.6.6 0 01-.6-.6z"/>',g:'<path d="M6 6h12v2H6z"/><path d="M6.5 8h11v11a2 2 0 01-2 2h-7a2 2 0 01-2-2z"/><path class="sw-fill" d="M7.2 14h9.6v5a1.4 1.4 0 01-1.4 1.4H8.6A1.4 1.4 0 017.2 19z"/>'};function dd(i){const t=ty[Gs(i)],e=Bx(i),n=i.kind==="imported"&&/^#[0-9a-f]{6}$/i.test(i.bottle.color)?` style="--sw:${i.bottle.color}"`:"";return`<span class="swatch swatch-${e}"${n} aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round">${t}</svg></span>`}const Ea=50;class ey{constructor(t,e){this.lib=t,this.addCard=e,this.el=q("aside",{class:"panel panel-left",id:"reagent-panel","aria-label":"Reagents"}),this.build(),this.lib.onChange=()=>this.queueRender()}el;onSelect;onImportPubChem;onSpawnGlassware;search;clearBtn;filterRow;results;pubchemSection;countEl;filter="all";selectedKey=null;renderQueued=!1;pcTimer=0;pcSeq=0;importing=!1;pcNames=[];pcState="idle";focusSearch(t){this.setCollapsed(!1),t!==void 0&&(this.search.value=t,this.onQueryChanged()),this.search.focus(),this.search.select()}setSelected(t){this.selectedKey=t,this.results.querySelectorAll(".r-row").forEach(e=>{e.setAttribute("aria-current",String(e.dataset.key===t))})}setCollapsed(t){this.el.dataset.collapsed=String(t),this.el.querySelector(".panel-collapse")?.setAttribute("aria-expanded",String(!t)),t||this.el.dispatchEvent(new CustomEvent("panel-expanded",{bubbles:!0}))}get collapsed(){return this.el.dataset.collapsed==="true"}queueRender(){this.renderQueued||(this.renderQueued=!0,requestAnimationFrame(()=>{this.renderQueued=!1,this.renderResults()}))}build(){const t=q("header",{class:"panel-head"});t.innerHTML='<h2 class="panel-title">Reagents</h2>',this.countEl=q("span",{class:"panel-count"});const e=q("button",{class:"icon-btn panel-collapse","aria-label":"Show or hide reagents","aria-expanded":"true","aria-controls":"reagent-panel-body",html:ee("chevronUp",16)});e.addEventListener("click",()=>this.setCollapsed(!this.collapsed)),t.append(this.countEl,e);const n=q("div",{class:"panel-body",id:"reagent-panel-body"}),s=q("div",{class:"search"});s.innerHTML=ee("search",16,"search-ic"),this.search=q("input",{type:"search",class:"search-input",placeholder:"Search reagents or PubChem","aria-label":"Search reagents or PubChem",autocomplete:"off",spellcheck:"false"}),this.clearBtn=q("button",{class:"icon-btn search-clear","aria-label":"Clear search",hidden:!0,html:ee("close",14)}),this.clearBtn.addEventListener("click",()=>{this.search.value="",this.onQueryChanged(),this.search.focus()}),this.search.addEventListener("input",()=>this.onQueryChanged()),this.search.addEventListener("keydown",l=>this.onSearchKey(l)),s.append(this.search,this.clearBtn),this.filterRow=q("div",{class:"filter-row",role:"group","aria-label":"Filter reagents"});for(const l of ba){const c=q("button",{class:"filter-chip",type:"button","aria-pressed":String(l.id===this.filter),text:l.label});c.addEventListener("click",()=>{this.filter=this.filter===l.id&&l.id!=="all"?"all":l.id,this.filterRow.querySelectorAll(".filter-chip").forEach((h,u)=>h.setAttribute("aria-pressed",String(ba[u].id===this.filter))),this.renderResults()}),this.filterRow.append(c)}this.results=q("div",{class:"results","aria-label":"Reagent results"}),this.pubchemSection=q("div",{class:"pc-section"});const r=q("div",{class:"panel-scroll"},this.results,this.pubchemSection);r.addEventListener("keydown",l=>this.onResultsKey(l));const o=q("footer",{class:"glass-row"});o.append(q("div",{class:"eyebrow",text:"Add glassware"}));const a=q("div",{class:"glass-grid"});for(const l of bl){const c=q("button",{class:"glass-btn",type:"button","aria-label":`Add ${l.label}`,title:`Add ${l.label}`});c.innerHTML=`${ee(l.icon,22)}<span>${l.label}</span>`,c.addEventListener("click",()=>this.onSpawnGlassware?.(l.type)),a.append(c)}o.append(a),n.append(s,this.filterRow,r,this.addCard.el,o),this.el.append(t,n),this.renderResults()}onQueryChanged(){this.clearBtn.hidden=this.search.value.length===0,this.renderResults(),this.schedulePubChem()}renderResults(){const t=this.search.value.trim();Le(this.countEl,this.lib.size?String(this.lib.size):""),this.results.innerHTML="";const e=t===""&&this.filter==="all"?this.lib.recentItems().slice(0,8):[];e.length&&this.results.append(this.section("Recently used",e));const{items:n,total:s}=this.lib.search(t,this.filter,Ea),r=new Set(e.map(l=>l.key)),o=n.filter(l=>!r.has(l.key)),a=t?"Matches":this.filter==="all"?e.length?"All reagents":"Reagents":ba.find(l=>l.id===this.filter).label;if(o.length)this.results.append(this.section(a,o)),s>Ea&&this.results.append(q("p",{class:"more-hint",text:`${s-Ea} more — type to narrow the list`}));else if(!e.length){const l=this.lib.size===0?"Loading reagents…":this.filter==="imported"&&!t?"Nothing imported yet. Search PubChem above to import any compound.":t?`No reagent matches “${t}”.`:"Nothing here.";this.results.append(q("p",{class:"empty-hint",text:l}))}this.renderPubChem(this.pcNames,this.pcState)}section(t,e){const n=q("div",{class:"r-section"});n.append(q("div",{class:"eyebrow",text:t}));const s=q("ul",{class:"r-list",role:"list"});for(const r of e)s.append(q("li",{},this.row(r)));return n.append(s),n}row(t){const e=q("button",{class:"r-row",type:"button","aria-current":String(t.key===this.selectedKey)});e.dataset.key=t.key;const n=ad(t),s=ls(Gl(t));return e.innerHTML=dd(t),e.append(q("span",{class:"r-main"},q("span",{class:"r-name",text:tr(t)}),q("span",{class:"r-sub",text:`${s} · ${rd(t)}`}))),t.kind==="imported"&&e.append(q("span",{class:"r-tag",text:"PubChem"})),n&&e.append(q("span",{class:`hz-dot ${n==="Danger"?"is-danger":"is-warning"}`,role:"img","aria-label":`Hazard: ${n}`,title:n})),e.addEventListener("click",()=>this.onSelect?.(t)),e}schedulePubChem(){window.clearTimeout(this.pcTimer);const t=this.search.value.trim();if(t.length<2){this.renderPubChem([],"idle");return}if(this.renderPubChem([],t.length>=3?"loading":"idle"),t.length<3)return;const e=++this.pcSeq;this.pcTimer=window.setTimeout(async()=>{let n=[];try{n=await Lx(t)}catch{n=[]}e!==this.pcSeq||this.search.value.trim()!==t||this.renderPubChem(n.slice(0,6),"done")},320)}renderPubChem(t,e){this.pcNames=t,this.pcState=e;const n=this.search.value.trim();if(this.pubchemSection.innerHTML="",n.length<2)return;this.pubchemSection.append(q("div",{class:"eyebrow",text:"PubChem"}));const s=q("button",{class:"pc-row pc-primary",type:"button",disabled:this.importing});s.innerHTML=ee("cloud",16),s.append(q("span",{text:this.importing?"Importing…":`Import “${n}” from PubChem`})),s.addEventListener("click",()=>this.importName(n)),this.pubchemSection.append(s),e==="loading"&&this.pubchemSection.append(q("p",{class:"pc-status",text:"Looking up suggestions…"}));const r=n.toLowerCase();for(const o of t.filter(a=>a.toLowerCase()!==r)){const a=q("button",{class:"pc-row",type:"button",disabled:this.importing});a.innerHTML=ee("plus",14),a.append(q("span",{text:o})),a.addEventListener("click",()=>this.importName(o)),this.pubchemSection.append(a)}this.pubchemSection.append(q("p",{class:"pc-status",text:"Imported compounds are visual only — no reaction data."}))}async importName(t){if(!(this.importing||!this.onImportPubChem)){this.importing=!0,this.renderPubChem(this.pcNames,"idle");try{await this.onImportPubChem(t),this.search.value="",this.onQueryChanged()}finally{this.importing=!1,this.renderPubChem([],"idle")}}}rows(){return Array.from(this.el.querySelectorAll(".r-row, .pc-row:not([disabled])"))}onSearchKey(t){if(t.key==="ArrowDown")t.preventDefault(),this.rows()[0]?.focus();else if(t.key==="Enter"){t.preventDefault();const e=this.results.querySelector(".r-row"),n=this.search.value.trim(),{total:s}=this.lib.search(n,this.filter,1);n&&s===0?this.importName(n):e?.click()}else t.key==="Escape"&&this.search.value&&(t.preventDefault(),t.stopPropagation(),this.search.value="",this.onQueryChanged())}onResultsKey(t){if(t.key!=="ArrowDown"&&t.key!=="ArrowUp")return;const e=this.rows(),n=e.indexOf(document.activeElement);n<0||(t.preventDefault(),t.key==="ArrowUp"&&n===0?this.search.focus():e[Math.max(0,Math.min(e.length-1,n+(t.key==="ArrowDown"?1:-1)))]?.focus())}}const Ta={ml:{values:[1,5,10,25,50],def:10,unit:"mL",step:.5,max:1e3},g:{values:[.1,.5,1,2],def:.5,unit:"g",step:.05,max:50},drops:{values:[1,3,5,10],def:3,unit:"drops",step:1,max:100}};class ny{constructor(t){this.host=t,this.el=q("section",{class:"add-card","aria-label":"Add reagent",hidden:!0})}el;item=null;onAdd;onClose;onProperties;onUseCatalog;amount=10;targetId=null;busy=!1;mode="ml";amountInput;presetBtns=[];vesselChips;warnEl;addBtn;addLabel;get isOpen(){return!this.el.hidden}show(t,e){this.item=t,this.mode=Gs(t),this.amount=Ta[this.mode].def;const n=this.host.vessels();this.targetId=e&&n.some(s=>s.id===e)?e:n[0]?.id??null,this.busy=!1,this.build(),this.el.hidden=!1,this.refresh()}hide(){this.el.hidden||(this.el.hidden=!0,this.item=null,this.onClose?.())}setDefaultVessel(t){!this.item||this.busy||!t||(this.targetId=t,this.renderVesselChips(),this.refresh())}vesselsChanged(){if(!this.item)return;const t=this.host.vessels();(!this.targetId||!t.some(e=>e.id===this.targetId))&&(this.targetId=t[0]?.id??null),this.renderVesselChips(),this.refresh()}build(){const t=this.item,e=Ta[this.mode];this.el.innerHTML="";const n=ad(t),s=od(Fx(t)),r=q("div",{class:"add-head"});r.innerHTML=dd(t);const o=q("div",{class:"add-titles"},q("h3",{class:"add-name",text:tr(t)}),q("div",{class:"add-sub",text:`${ls(Gl(t))} · ${rd(t)}`})),a=q("button",{class:"icon-btn","aria-label":"Close add card",html:ee("close",16)});if(a.addEventListener("click",()=>this.hide()),r.append(o,a),this.el.append(r),(n||s.length)&&this.el.append(q("div",{class:`add-hazard ${n==="Danger"?"is-danger":"is-warning"}`},q("span",{class:"hz-dot","aria-hidden":"true"}),q("span",{text:[n,s.join(", ")].filter(Boolean).join(" · ")}))),t.kind==="imported"){const g=q("div",{class:"add-note"});g.innerHTML=`${ee("info",14)}<span>Visual only — PubChem compounds have no reaction data, so nothing reacts.</span>`,this.el.append(g);const _=this.host.catalogMatchFor(t),m=q("div",{class:"add-links"});if(_){const x=q("button",{class:"link-btn",text:`Use reacting version: ${_.name}`});x.addEventListener("click",()=>this.onUseCatalog?.(_)),m.append(x)}const p=q("button",{class:"link-btn",html:`${ee("list",14)} Properties`});p.addEventListener("click",()=>this.onProperties?.(t)),m.append(p),this.el.append(m)}const l=`add-amount-${Math.random().toString(36).slice(2,7)}`,c=q("div",{class:"field"});c.append(q("label",{class:"field-label",for:l,text:"Amount"}));const h=q("div",{class:"chip-row",role:"group","aria-label":"Amount presets"});this.presetBtns=e.values.map(g=>{const _=q("button",{class:"chip",type:"button","aria-pressed":"false",text:`${g} ${e.unit==="drops"?g===1?"drop":"drops":e.unit}`});return _.dataset.v=String(g),_.addEventListener("click",()=>{this.amount=g,this.amountInput.value=String(g),this.refresh()}),h.append(_),_});const u=q("div",{class:"num-input"});this.amountInput=q("input",{id:l,type:"number",inputmode:"decimal",min:String(e.step),max:String(e.max),step:String(e.step),value:String(this.amount)}),this.amountInput.addEventListener("input",()=>{const g=parseFloat(this.amountInput.value);this.amount=isFinite(g)?g:0,this.refresh()}),this.amountInput.addEventListener("keydown",g=>{g.key==="Enter"&&(g.preventDefault(),this.submit())}),u.append(this.amountInput,q("span",{class:"num-unit",text:e.unit})),c.append(q("div",{class:"amount-line"},h,u)),this.el.append(c);const d=q("div",{class:"field"});d.append(q("div",{class:"field-label",id:`${l}-into`,text:"Into"})),this.vesselChips=q("div",{class:"chip-row",role:"radiogroup","aria-labelledby":`${l}-into`}),d.append(this.vesselChips),this.el.append(d),this.renderVesselChips(),this.warnEl=q("div",{class:"add-warn",role:"status","aria-live":"polite"}),this.el.append(this.warnEl),this.addBtn=q("button",{class:"btn btn-primary btn-block",type:"button"});const f=this.mode==="drops"?ee("drop",16):this.mode==="g"?ee("scoop",16):ee("pour",16);this.addBtn.innerHTML=f,this.addLabel=q("span"),this.addBtn.append(this.addLabel),this.addBtn.addEventListener("click",()=>this.submit()),this.el.append(this.addBtn)}renderVesselChips(){if(!this.vesselChips)return;this.vesselChips.innerHTML="";const t=this.host.vessels();if(t.length===0){this.vesselChips.append(q("span",{class:"muted",text:"No glassware on the bench — add some below."}));return}for(const e of t){const n=e.id===this.targetId,s=q("button",{class:"chip chip-vessel",type:"button",role:"radio","aria-checked":n?"true":"false",tabindex:n?"0":"-1",text:e.name});s.addEventListener("click",()=>{this.targetId=e.id,this.renderVesselChips(),this.refresh(),this.vesselChips.querySelector('[aria-checked="true"]')?.focus()}),s.addEventListener("keydown",r=>{if(r.key!=="ArrowRight"&&r.key!=="ArrowLeft")return;r.preventDefault();const o=t.findIndex(l=>l.id===this.targetId),a=t[(o+(r.key==="ArrowRight"?1:t.length-1))%t.length];this.targetId=a.id,this.renderVesselChips(),this.refresh(),this.vesselChips.querySelector('[aria-checked="true"]')?.focus()}),this.vesselChips.append(s)}}refresh(){if(!this.item||!this.addBtn)return;const t=Ta[this.mode];for(const o of this.presetBtns)o.setAttribute("aria-pressed",String(Number(o.dataset.v)===this.amount));const e=this.host.vessels().find(o=>o.id===this.targetId),n=this.mode==="drops"?this.amount===1?"drop":"drops":t.unit,s=`${+this.amount.toFixed(3)} ${n}`;let r="";if(!e)r="Add a beaker or flask to the bench first.";else if(this.host.isBroken(e.id))r=`${e.name} is broken. Pick another vessel.`;else if(!(this.amount>0))r="Enter an amount greater than zero.";else{const o=To.addedVolumeMl(this.item,this.amount),a=this.host.freeCapacityMl(e.id);o>a+1e-6&&(r=`Too much: ${e.name} has ${a.toFixed(1)} mL of space left.`)}Le(this.warnEl,r),this.warnEl.hidden=!r,Le(this.addLabel,this.busy?"Adding…":e?`Add ${s} to ${e.name}`:"Add"),this.addBtn.disabled=this.busy||!!r,this.addBtn.setAttribute("aria-busy",String(this.busy))}async submit(){if(!(!this.item||!this.targetId||this.busy)&&(this.refresh(),!this.addBtn.disabled)){this.busy=!0,this.refresh();try{await this.onAdd?.(this.item,this.targetId,this.amount)}finally{this.busy=!1,this.refresh()}}}}let $n=null;function iy(){return $n||($n=document.createElement("div"),$n.className="toast-region",$n.setAttribute("role","status"),$n.setAttribute("aria-live","polite"),document.body.appendChild($n),$n)}function ye(i,t="info",e=4200){const n=iy(),s=document.createElement("div");s.className=`toast toast-${t}`,t==="error"&&s.setAttribute("role","alert");const r=t==="success"?"check":t==="error"||t==="warning"?"warning":"info";s.innerHTML=`${ee(r,16)}<span class="toast-msg"></span><button class="toast-close" aria-label="Dismiss">${ee("close",14)}</button>`,s.querySelector(".toast-msg").textContent=i;const o=()=>{s.classList.add("leaving"),window.setTimeout(()=>s.remove(),220)};for(s.querySelector(".toast-close")?.addEventListener("click",o),n.appendChild(s);n.children.length>4;)n.firstElementChild?.remove();window.setTimeout(o,t==="error"?e*1.6:e)}const fd={burst:"Vessel burst",stopper_pop:"Stopper popped",ignition:"Ignited",flame_out:"Flame went out",boil_over:"Boiled over",splatter:"Splattered",dry_out:"Boiled dry",conservation_warning:"Conservation warning",solver_warning:"Solver warning"},$h=6;function qr(i,t){i.catch(e=>{const n=e instanceof Error?e.message:String(e);ye(`Couldn't ${t}: ${n}`,"error")})}class sy{constructor(t){this.deps=t,this.el=q("aside",{class:"panel panel-right",id:"vessel-panel","aria-label":"Selected vessel"}),this.empty=q("div",{class:"panel-empty"}),this.empty.innerHTML=`${ee("beaker",36)}<p class="empty-title">Click a beaker on the bench</p><p class="muted">Its temperature, pH, contents and controls appear here.</p>`,this.content=q("div",{class:"vp"}),this.el.append(this.empty,this.content),this.show(null)}el;id=null;empty;content;r={};heat;heatVal;heatNote;toggles={};igniteBtn;contentRows=[];contentEmpty;eventsList;eventsSec;lastEventsLen=-1;contentOrder=[];contentSlots=0;lastContentsAt=0;pourTargets;pourTarget=null;pourRange;pourNum;pourBtn;pourLabel;pourBusy=!1;pourSec;brokenBanner;heatTimer=0;get vesselId(){return this.id}show(t){this.id=t,this.lastEventsLen=-1,this.contentOrder=[],this.contentSlots=0,this.lastContentsAt=0;const e=t?this.deps.lab.get(t):void 0;if(this.empty.hidden=!!e,this.content.hidden=!e,this.el.dataset.empty=String(!e),!e)return;this.build(),this.syncControls();const n=this.deps.lab.snapshot(e.id);n&&this.update(n)}vesselsChanged(){if(this.id){if(!this.deps.lab.has(this.id)){this.show(null);return}this.renderPourTargets()}}build(){const t=this.deps.lab,e=t.get(this.id),n=hd(e.type);this.content.innerHTML="",this.r={};const s=q("header",{class:"vp-head"}),r=q("div",{class:"vp-titles"},q("h2",{class:"vp-name",text:e.name}));this.r.sub=q("div",{class:"vp-sub",text:`${n.capacityMl} mL`}),r.append(this.r.sub);const o=q("button",{class:"icon-btn","aria-label":"Focus camera on this vessel (F)",title:"Focus camera (F)",html:ee("focus",18)});o.addEventListener("click",()=>this.deps.focusVessel(e.id));const a=q("button",{class:"icon-btn btn-danger-quiet","aria-label":"Remove vessel from bench",title:"Remove vessel",html:ee("trash",18)});this.confirmable(a,"Remove?",()=>qr(t.remove(e.id),"remove the vessel")),s.append(r,q("div",{class:"vp-actions"},o,a)),this.brokenBanner=q("div",{class:"vp-banner",role:"alert",hidden:!0}),this.brokenBanner.innerHTML=`${ee("warning",16)}<span>The glass shattered from over-pressure. Remove it and start again.</span>`;const l=q("div",{class:"readouts",role:"group","aria-label":"Live readings"}),c=(I,F,U="")=>{const O=q("div",{class:`ro ro-${I}`}),V=q("output",{class:"ro-val","aria-live":"off",text:"—"});return O.append(q("span",{class:"ro-label",text:F}),V),U&&O.append(q("span",{class:"ro-unit",text:U})),this.r[I]=V,this.r[`${I}Cell`]=O,l.append(O),O};c("temp","Temp"),c("ph","pH");const h=c("vol","Volume"),u=q("div",{class:"ro-gauge","aria-hidden":"true"},q("div",{class:"ro-gauge-fill"}));this.r.gaugeFill=u.firstElementChild,h.append(u),c("mass","Mass"),c("press","Pressure"),this.eventsSec=q("section",{class:"vp-sec vp-events",hidden:!0,"aria-label":"Events"}),this.eventsList=q("ol",{class:"events","aria-live":"polite"}),this.eventsSec.append(q("h3",{class:"eyebrow",text:"Events"}),this.eventsList);const d=q("section",{class:"vp-sec","aria-label":"Controls"});d.append(q("h3",{class:"eyebrow",text:"Controls"}));const f=`heat-${e.id}`,g=q("div",{class:"heat"}),_=q("label",{class:"heat-label",for:f});_.innerHTML=`${ee("heat",18)}<span>Heat</span>`,this.heatVal=q("span",{class:"heat-val",text:"Off"}),this.heat=q("input",{id:f,class:"range",type:"range",min:"0",max:"1000",step:"50",value:"0"}),this.heat.addEventListener("input",()=>{const I=Number(this.heat.value);this.paintHeat(I),window.clearTimeout(this.heatTimer),this.heatTimer=window.setTimeout(()=>{if(!this.id)return;const F=this.id;qr(t.setHeat(F,I).then(()=>this.updateSub()),"set the heat")},120)}),g.append(_,this.heat,this.heatVal),this.heatNote=q("p",{class:"hint-line",text:"Turning on heat or stirring moves this vessel onto the hot plate."});const m=q("div",{class:"toggle-row"}),p=(I,F,U,O)=>{const V=q("button",{class:"toggle",type:"button","aria-pressed":"false"});V.innerHTML=`${ee(F,18)}<span>${U}</span>`,V.addEventListener("click",()=>{const G=V.getAttribute("aria-pressed")!=="true";V.setAttribute("aria-pressed",String(G)),O(G).then(()=>this.updateSub()).catch(D=>{V.setAttribute("aria-pressed",String(!G)),ye(`Couldn't change ${U.toLowerCase()}: ${D instanceof Error?D.message:String(D)}`,"error")})}),this.toggles[I]=V,m.append(V)};p("stir","stir","Stir",I=>t.setStir(e.id,I)),p("ice","ice","Ice bath",I=>t.setIceBath(e.id,I)),p("stopper","stopper","Stopper",I=>t.setSealed(e.id,I)),this.igniteBtn=q("button",{class:"btn btn-warm btn-block",type:"button",hidden:!0}),this.igniteBtn.innerHTML=`${ee("flame",16)}<span>Ignite with lighter</span>`,this.igniteBtn.addEventListener("click",()=>qr(t.ignite(e.id),"ignite")),d.append(g,this.heatNote,m,this.igniteBtn);const x=q("section",{class:"vp-sec","aria-label":"Contents"}),M=q("div",{class:"sec-head"},q("h3",{class:"eyebrow",text:"Contents"})),v=q("button",{class:"link-btn",type:"button",text:"Show all in Details"});v.addEventListener("click",()=>this.deps.openDetails()),M.append(v);const A=q("ul",{class:"contents",role:"list"});this.contentRows=[];for(let I=0;I<$h;I++){const F=q("span",{class:"c-formula"}),U=q("span",{class:"c-name"}),O=q("span",{class:"c-amt"}),V=q("li",{hidden:!0},q("span",{class:"c-id"},F,U),O);A.append(V),this.contentRows.push({li:V,f:F,n:U,a:O})}this.contentEmpty=q("p",{class:"muted",text:"Empty. Pick a reagent on the left to add it."}),x.append(M,A,this.contentEmpty),this.pourSec=q("section",{class:"vp-sec","aria-label":"Pour into another vessel"}),this.pourSec.append(q("h3",{class:"eyebrow",text:"Pour into"})),this.pourTargets=q("div",{class:"chip-row",role:"radiogroup","aria-label":"Pour target"});const E=q("div",{class:"pour-amt"}),R=`pour-${e.id}`;this.pourRange=q("input",{class:"range",type:"range",min:"0",max:"0",step:"1",value:"0","aria-label":"Amount to pour in millilitres"}),this.pourNum=q("input",{id:R,type:"number",min:"0",step:"1",value:"0",inputmode:"decimal","aria-label":"Amount to pour (mL)"}),this.pourRange.addEventListener("input",()=>{this.pourNum.value=this.pourRange.value,this.refreshPour()}),this.pourNum.addEventListener("input",()=>{this.pourRange.value=this.pourNum.value,this.refreshPour()});const P=q("div",{class:"num-input num-sm"},this.pourNum,q("span",{class:"num-unit",text:"mL"}));E.append(this.pourRange,P);const b=q("div",{class:"chip-row chip-row-tight",role:"group","aria-label":"Pour presets"});for(const[I,F]of[["10 mL",10],["25 mL",25],["Half",-.5],["All",-1]]){const U=q("button",{class:"chip",type:"button",text:I});U.addEventListener("click",()=>{const O=Number(this.pourRange.max),V=this.id?t.volumeMl(this.id):0,G=F<0?Math.min(O,V*-F):Math.min(O,F);this.setPourValue(G)}),b.append(U)}this.pourBtn=q("button",{class:"btn btn-primary btn-block",type:"button"}),this.pourBtn.innerHTML=ee("pour",16),this.pourLabel=q("span",{text:"Pour"}),this.pourBtn.append(this.pourLabel),this.pourBtn.addEventListener("click",()=>this.doPour());const y=q("button",{class:"btn btn-ghost btn-block",type:"button"});y.innerHTML=`${ee("bucket",16)}<span>Empty into waste</span>`,this.confirmable(y,"Tap again to empty",()=>qr(t.empty(e.id).then(()=>ye(`Emptied ${e.name}.`,"success")),"empty the vessel")),this.pourSec.append(this.pourTargets,E,b,this.pourBtn,y),this.r.pourEmptyBtn=y,this.content.append(s,this.brokenBanner,l,this.eventsSec,d,x,this.pourSec),this.renderPourTargets(),this.updateSub()}confirmable(t,e,n){let s=!1,r=0;const o=t.innerHTML,a=t.getAttribute("aria-label");t.addEventListener("click",()=>{if(!s){s=!0,t.classList.add("is-armed"),t.innerHTML=`${ee("warning",16)}<span>${e}</span>`,t.setAttribute("aria-label",`${e} Press again to confirm.`),r=window.setTimeout(l,4e3);return}l(),n()});const l=()=>{s=!1,window.clearTimeout(r),t.classList.remove("is-armed"),t.innerHTML=o,a?t.setAttribute("aria-label",a):t.removeAttribute("aria-label")}}syncControls(){if(!this.id||!this.heat)return;const t=this.deps.lab.ctl(this.id),e=this.deps.lab.get(this.id);document.activeElement!==this.heat&&(this.heat.value=String(t.heaterW),this.paintHeat(t.heaterW)),this.toggles.stir.setAttribute("aria-pressed",String(t.stirring)),this.toggles.ice.setAttribute("aria-pressed",String(t.iceBath)),this.toggles.stopper.setAttribute("aria-pressed",String(!!e?.isSealed)),this.updateSub()}paintHeat(t){Le(this.heatVal,t<=0?"Off":`${t} W`),this.heat.setAttribute("aria-valuetext",t<=0?"Off":`${t} watts`),this.heat.style.setProperty("--fill",`${t/1e3*100}%`),this.heat.classList.toggle("is-hot",t>0)}updateSub(){if(!this.id||!this.r.sub)return;const t=this.deps.lab,e=t.get(this.id);if(!e)return;const n=[`${e.capacityMl} mL`],s=t.isOnHotPlate(this.id);s&&n.push("on hot plate"),e.isSealed&&n.push("stoppered"),t.ctl(this.id).iceBath&&n.push("in ice bath"),Le(this.r.sub,n.join(" · ")),this.heatNote.hidden=s}update(t){if(!this.id||this.content.hidden)return;const e=this.deps.lab,n=e.get(this.id);if(!n)return;const s=this.deps.readouts();Le(this.r.temp,s.temperature),Le(this.r.ph,t.total_liquid_ml>.05?s.ph:"—"),Le(this.r.mass,s.mass);const r=t.total_liquid_ml;Le(this.r.vol,`${r<10?r.toFixed(1):r.toFixed(0)} mL`),this.r.gaugeFill.style.transform=`scaleY(${Math.min(1,r/n.capacityMl)})`,this.r.volCell.title=`${r.toFixed(1)} of ${n.capacityMl} mL`,this.r.pressCell.hidden=!t.sealed,t.sealed&&Le(this.r.press,s.pressure),this.brokenBanner.hidden=!t.burst,this.el.classList.toggle("is-broken",t.burst),this.toggles.stopper.getAttribute("aria-pressed")==="true"!==t.sealed&&(this.toggles.stopper.setAttribute("aria-pressed",String(t.sealed)),this.updateSub()),this.igniteBtn.hidden=!(e.hasFlammable(this.id)&&!t.flame&&!t.burst),this.updateContents(t),this.updateEvents(t),this.refreshPour()}updateContents(t){const e=performance.now();if(e-this.lastContentsAt<250)return;this.lastContentsAt=e;const n=new Map;for(const h of t.species)h.phase==="gas"||h.id==="H2O"||n.set(`${h.id}|${h.phase}`,h);const s=this.contentOrder.filter(h=>(n.get(h)?.amount_mol??0)>5e-10),r=new Set(s),o=[...n.values()].filter(h=>!r.has(`${h.id}|${h.phase}`)&&h.amount_mol>1e-9).sort((h,u)=>u.amount_mol-h.amount_mol||(h.id<u.id?-1:1));for(const h of o)s.push(`${h.id}|${h.phase}`);const a=h=>n.get(h).amount_mol;for(let h=0,u=!0;u&&h<s.length+2;h++){u=!1;for(let d=1;d<s.length;d++)a(s[d])>a(s[d-1])*1.5&&([s[d-1],s[d]]=[s[d],s[d-1]],u=!0)}this.contentOrder=s;const l=s.slice(0,$h).map(h=>n.get(h));this.contentSlots=Math.max(this.contentSlots,l.length);const c=t.total_liquid_ml>.01||this.contentSlots>0;this.contentEmpty.hidden!==c&&(this.contentEmpty.hidden=c),this.contentRows.forEach((h,u)=>{const d=l[u],f=u>=this.contentSlots;h.li.hidden!==f&&(h.li.hidden=f);const g=!d&&!f;if(h.li.classList.contains("is-ghost")!==g&&h.li.classList.toggle("is-ghost",g),!d)return;const _=ls(d.formula||d.id);Le(h.f,_),Le(h.n,d.name&&d.name!==d.formula&&d.name!==d.id?d.name:""),Le(h.a,d.conc_m!==null&&d.phase!=="solid"?Kx(d.conc_m):Zx(d.amount_mol))})}updateEvents(t){const e=t.events??[];if(e.length===this.lastEventsLen)return;this.lastEventsLen=e.length;const n=[];for(const r of e){const o=n[n.length-1];o&&o.kind===r.kind&&r.t_sim_s-o.t_sim_s<5||n.push(r)}const s=n.slice(-4).reverse();this.eventsSec.hidden=s.length===0,this.eventsList.innerHTML="";for(const r of s){const o=q("li",{class:`ev ev-${r.kind}`});o.append(q("span",{class:"ev-kind",text:fd[r.kind]??r.kind})),r.detail&&o.append(q("span",{class:"ev-detail",text:r.detail})),o.append(q("time",{class:"ev-t",text:ud(r.t_sim_s)})),this.eventsList.append(o)}}renderPourTargets(){if(!this.id||!this.pourTargets)return;const t=this.deps.lab.list().filter(e=>e.id!==this.id);(!this.pourTarget||!t.some(e=>e.id===this.pourTarget))&&(this.pourTarget=t[0]?.id??null),this.pourTargets.innerHTML="",t.length===0&&this.pourTargets.append(q("span",{class:"muted",text:"Add another vessel to pour into."}));for(const e of t){const n=e.id===this.pourTarget,s=q("button",{class:"chip chip-vessel",type:"button",role:"radio","aria-checked":String(n),tabindex:n?"0":"-1",text:e.name});s.addEventListener("click",()=>{this.pourTarget=e.id,this.renderPourTargets(),this.pourTargets.querySelector('[aria-checked="true"]')?.focus()}),s.addEventListener("keydown",r=>{if(r.key!=="ArrowRight"&&r.key!=="ArrowLeft")return;r.preventDefault();const o=t.findIndex(a=>a.id===this.pourTarget);this.pourTarget=t[(o+(r.key==="ArrowRight"?1:t.length-1))%t.length].id,this.renderPourTargets(),this.pourTargets.querySelector('[aria-checked="true"]')?.focus()}),this.pourTargets.append(s)}this.refreshPour()}setPourValue(t){const e=Math.max(0,Math.round(t*10)/10);this.pourRange.value=String(e),this.pourNum.value=String(e),this.refreshPour()}refreshPour(){if(!this.id||!this.pourBtn)return;const t=this.deps.lab,e=this.pourTarget?t.get(this.pourTarget):void 0,n=t.volumeMl(this.id),s=e?t.maxPourMl(this.id,e.id):0,r=String(Math.floor(s*10)/10);this.pourRange.max!==r&&(this.pourRange.max=r,this.pourNum.max=r);let o=parseFloat(this.pourNum.value);isFinite(o)||(o=0),o>s&&document.activeElement!==this.pourNum&&(o=Math.floor(s*10)/10,this.pourNum.value=String(o),this.pourRange.value=String(o)),this.pourRange.style.setProperty("--fill",`${s>0?Math.min(o,s)/s*100:0}%`);const a=!!t.snapshot(this.id)?.burst;let l;this.pourBusy?l="Pouring…":e?n<=.01?l="Nothing to pour":s<=.01?l=`${e.name} is full`:o>s+1e-6?l=`Max ${s.toFixed(1)} mL`:l=`Pour ${+o.toFixed(1)} mL into ${e.name}`:l="No other vessel",Le(this.pourLabel,l),this.pourBtn.disabled=this.pourBusy||a||!e||!(o>.01)||o>s+1e-6,this.r.pourEmptyBtn.disabled=n<=.01&&!t.snapshot(this.id)?.solids.length}doPour(){if(!this.id||!this.pourTarget||this.pourBusy)return;const t=this.id,e=this.pourTarget,n=parseFloat(this.pourNum.value);this.pourBusy=!0,this.refreshPour(),this.deps.lab.pour(t,e,n).catch(s=>ye(`Couldn't pour: ${s instanceof Error?s.message:String(s)}`,"error")).finally(()=>{this.pourBusy=!1,this.refreshPour()})}}const jh=[1,5,20];class ry{constructor(t){this.sim=t,this.el=q("div",{class:"timebar",role:"toolbar","aria-label":"Simulation time"}),this.playBtn=q("button",{class:"icon-btn time-play",type:"button"}),this.playBtn.addEventListener("click",()=>this.togglePause()),this.clock=q("span",{class:"time-clock","aria-label":"Simulated time",text:"00:00.0"});const e=q("div",{class:"seg",role:"group","aria-label":"Speed"});for(const n of jh){const s=q("button",{class:"seg-btn",type:"button","aria-pressed":String(n===t.speedMultiplier),text:`${n}×`,"aria-label":`${n} times speed`});s.addEventListener("click",()=>this.setSpeed(n)),e.append(s),this.speedBtns.push(s)}this.el.append(this.playBtn,this.clock,e),this.paint()}el;playBtn;clock;speedBtns=[];togglePause(){this.sim.isPaused=!this.sim.isPaused,this.paint()}setSpeed(t){this.sim.speedMultiplier=t,this.paint()}setClock(t){Le(this.clock,ud(t))}paint(){const t=this.sim.isPaused;this.playBtn.innerHTML=ee(t?"play":"pause",16),this.playBtn.setAttribute("aria-label",t?"Resume simulation (Space)":"Pause simulation (Space)"),this.playBtn.title=t?"Resume (Space)":"Pause (Space)",this.el.classList.toggle("is-paused",t),this.speedBtns.forEach((e,n)=>e.setAttribute("aria-pressed",String(jh[n]===this.sim.speedMultiplier)))}}const Yi={temp:"#d1495b",ph:"#0f7c86",press:"#6a4fb3"};class oy{el;isVisible=!1;onVisibilityChange;snap=null;history=[];vesselId=null;canvas;subtitle;lastTable=0;lastPlot=0;maxHistoryS=600;constructor(){this.el=q("aside",{class:"drawer",id:"details-drawer","aria-label":"Details",hidden:!0,tabindex:"-1"}),this.el.innerHTML=`
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
            <span><i style="background:${Yi.temp}"></i>Temperature (270–380 K)</span>
            <span><i style="background:${Yi.ph}"></i>pH (0–14)</span>
            <span><i style="background:${Yi.press}"></i>Pressure (0.5–4 atm)</span>
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
              <td><span class="mono">${Ie(ls(o.formula||o.id))}</span>${o.name&&o.name!==o.formula&&o.name!==o.id?` <span class="muted">${Ie(o.name)}</span>`:""}</td>
              <td><span class="tag">${Ie(o.phase)}</span></td>
              <td class="num mono">${o.amount_mol.toExponential(3)}</td>
              <td class="num mono">${o.conc_m!==null?o.conc_m.toExponential(3):"—"}</td>
              <td class="num mono">${o.activity!==null?o.activity.toExponential(3):"—"}</td>
              <td><span class="tier tier-${Ie(o.tier)}">${Ie(o.tier)}</span></td></tr>`).join(""):'<tr><td colspan="6" class="empty-cell">Empty</td></tr>'}drawPlot(){const t=this.canvas,e=t.parentElement?.clientWidth||600,n=170,s=Math.min(window.devicePixelRatio||1,2);(t.width!==Math.round(e*s)||t.height!==Math.round(n*s))&&(t.width=Math.round(e*s),t.height=Math.round(n*s),t.style.width=`${e}px`,t.style.height=`${n}px`);const r=t.getContext("2d");if(!r)return;r.setTransform(s,0,0,s,0,0),r.clearRect(0,0,e,n),r.strokeStyle="rgba(29,39,48,0.08)",r.lineWidth=1;for(let f=1;f<5;f++){const g=Math.round(n/5*f)+.5;r.beginPath(),r.moveTo(0,g),r.lineTo(e,g),r.stroke()}const o=this.history;if(o.length<2){r.fillStyle="rgba(29,39,48,0.45)",r.font="12px Archivo, system-ui, sans-serif",r.fillText("Waiting for data…",12,n/2);return}const a=o[0].t,l=Math.max(a+5,o[o.length-1].t),c=8,h=f=>c+(f-a)/(l-a)*(e-c*2),u=(f,g,_)=>n-c-(f-g)/(_-g)*(n-c*2),d=(f,g,_,m)=>{r.strokeStyle=f,r.lineWidth=2,r.lineJoin="round",r.beginPath();let p=!1;for(const x of o){const M=g(x);if(M===null){p=!1;continue}const v=u(Math.max(_,Math.min(m,M)),_,m);p?r.lineTo(h(x.t),v):(r.moveTo(h(x.t),v),p=!0)}r.stroke()};d(Yi.temp,f=>f.tempK,270,380),d(Yi.ph,f=>f.ph,0,14),d(Yi.press,f=>f.pressureAtm,.5,4)}}class Wl{dialog;body;footer;titleEl;onClose;constructor(t,e={}){this.dialog=document.createElement("dialog"),this.dialog.className=`modal ${e.wide?"modal-wide":""} ${e.className??""}`;const n=`modal-title-${Math.random().toString(36).slice(2,8)}`;this.dialog.setAttribute("aria-labelledby",n),this.dialog.innerHTML=`
      <header class="modal-head">
        <h2 class="modal-title" id="${n}"></h2>
        <button class="icon-btn modal-x" aria-label="Close">${ee("close",18)}</button>
      </header>
      <div class="modal-body"></div>
      <footer class="modal-foot" hidden></footer>`,this.titleEl=this.dialog.querySelector(".modal-title"),this.titleEl.textContent=t,this.body=this.dialog.querySelector(".modal-body"),this.footer=this.dialog.querySelector(".modal-foot"),this.dialog.querySelector(".modal-x")?.addEventListener("click",()=>this.close()),this.dialog.addEventListener("click",s=>{s.target===this.dialog&&this.close()}),this.dialog.addEventListener("close",()=>this.onClose?.()),document.body.appendChild(this.dialog)}setTitle(t){this.titleEl.textContent=t}open(){this.dialog.open||this.dialog.showModal()}close(){this.dialog.open&&this.dialog.close()}get isOpen(){return this.dialog.open}}function ay(){return document.querySelector("dialog[open]")!==null}class ly{modal;onRegisterCompound;onRegisterReaction;constructor(){this.modal=new Wl("Custom chemistry",{className:"modal-custom"}),this.modal.body.innerHTML=`
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
      </form>`,this.bind()}show(){this.modal.open(),this.modal.body.querySelector("form:not([hidden]) input")?.focus()}hide(){this.modal.close()}bind(){const t=this.modal.body,e=Array.from(t.querySelectorAll('[role="tab"]')),n=l=>{e.forEach((c,h)=>{c.setAttribute("aria-selected",String(l===h)),c.tabIndex=l===h?0:-1,t.querySelector(`#${c.getAttribute("aria-controls")}`).hidden=l!==h}),e[l].focus()};e.forEach((l,c)=>{l.addEventListener("click",()=>n(c)),l.addEventListener("keydown",h=>{(h.key==="ArrowRight"||h.key==="ArrowLeft")&&(h.preventDefault(),n((c+1)%e.length))})});const s=t.querySelector("#cc-pane-comp"),r=t.querySelector("#cc-pane-rxn"),o=(l,c)=>{const h=l.querySelector(".form-error");h.textContent=c,h.hidden=!c},a=(l,c)=>(l.elements.namedItem(c)?.value??"").trim();s.addEventListener("submit",async l=>{l.preventDefault();const c=a(s,"id"),h=a(s,"formula"),u=a(s,"form"),d=a(s,"conc")?parseFloat(a(s,"conc")):void 0,f=parseFloat(a(s,"density"))||1,g=a(s,"bottle");if(!c||!h)return o(s,"Enter a name and a formula.");if(u==="solution"&&!(d&&d>0))return o(s,"Enter a concentration for a solution.");o(s,"");const _=c.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"")||h,m={};u==="solution"&&d?(m[h]=d/1e3,m.H2O=.055):u==="solid"?m[`${h}(s)`]=.01:m[h]=.02;const p={id:_,name:c,formula:h,form:u,concentration_m:d,density_g_ml:f,ghs:["GHS07"],signal_word:"Warning",bottle_colour:g,composition:m,label:h,by_mass:u==="solid"};(await this.onRegisterCompound?.(p)??!1)&&(s.reset(),this.hide())}),r.addEventListener("submit",async l=>{l.preventDefault();const c=a(r,"id"),h=a(r,"equation");if(!c||!h)return o(r,"Enter a reaction ID and an equation.");if(!/(<=>|->|→|⇌)/.test(h))return o(r,"Use “<=>” for an equilibrium or “->” for a one-way reaction.");o(r,""),(await this.onRegisterReaction?.({id:c,equation:h,type:a(r,"type"),k:parseFloat(a(r,"k"))||0,delta_h_kj:parseFloat(a(r,"dh"))||0,ea:parseFloat(a(r,"ea"))||0})??!1)&&(r.reset(),this.hide())})}}const Aa=[{key:"mp_c",label:"Melting point (°C)",type:"number",step:"0.1"},{key:"bp_c",label:"Boiling point (°C)",type:"number",step:"0.1"},{key:"density",label:"Density (g/cm³)",type:"number",step:"0.001"},{key:"solubility",label:"Solubility",type:"text"}];class cy{modal;bottle=null;onBottleUpdated;onAddToVessel;constructor(){this.modal=new Wl("Compound",{className:"modal-bottle"})}async showBottle(t){this.bottle=t;try{const e=await Cx(t.inchi_key);e&&(t.userOverrides={...e})}catch{}this.render(),this.modal.open()}hide(){this.modal.close()}render(){const t=this.bottle;if(!t)return;const e=t.userOverrides||{};this.modal.setTitle(t.name);let n="";try{n=sd(t.smiles).components.map(l=>`<span class="pill mono">${Ie(ls(l.formula))} ×${l.stoichiometry}</span>`).join("")}catch{n=""}const s=od(t.ghs),r=Aa.some(a=>e[a.key]!==void 0);this.modal.body.innerHTML=`
      <p class="bc-sub"><span class="mono">${Ie(ls(t.formula))}</span> · ${t.mw?t.mw.toFixed(2)+" g/mol":""}${t.cid?` · CID ${t.cid}`:""}</p>
      <p class="add-note">Visual only — imported from PubChem, so it has no reaction data.</p>
      ${s.length?`<p class="add-hazard is-warning"><span class="hz-dot" aria-hidden="true"></span>${Ie(s.join(", "))}</p>`:""}
      <form class="form" novalidate>
        <div class="form-grid">
          ${Aa.map(a=>{const l=t.sourcedProperties[a.key],c=e[a.key]!==void 0?e[a.key]:l;return`<label class="f">${a.label}${e[a.key]!==void 0?' <span class="tag tag-user">edited</span>':""}
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
      </form>`;const o=this.modal.body.querySelector("form");o.addEventListener("submit",async a=>{a.preventDefault();const l={};for(const c of Aa){const h=o.elements.namedItem(c.key).value.trim(),u=t.sourcedProperties[c.key];if(c.type==="number"){const d=parseFloat(h);isFinite(d)&&d!==u&&(l[c.key]=d)}else h&&h!==u&&(l[c.key]=h)}t.userOverrides=l,await this.persist(t),ye("Saved changes.","success"),this.render()}),o.querySelector('[data-act="reset"]')?.addEventListener("click",async()=>{t.userOverrides={},await this.persist(t),ye("Reset to PubChem values.","success"),this.render()}),o.querySelector('[data-act="add"]')?.addEventListener("click",()=>{this.hide(),this.onAddToVessel?.(t)})}async persist(t){try{await Ax(t.inchi_key,t.userOverrides)}catch{}this.onBottleUpdated?.(t)}}const Kh="rc.hint.dismissed.v2";function hy(i){if(ho(Kh,!1))return null;const t=q("div",{class:"hint",role:"note"});t.innerHTML=`${ee("info",16)}<span class="hint-text"></span>`,t.querySelector(".hint-text").textContent=i;const e=q("button",{class:"icon-btn","aria-label":"Dismiss hint",html:ee("close",14)});return e.addEventListener("click",()=>{Vs(Kh,!0),t.remove()}),t.append(e),t}let Es=null,Ca=!1;async function uy(i,t,e){if(Es||(Es=new Wl("Self-test · M0–M5 validation gates",{wide:!0,className:"modal-test"})),Es.open(),Ca)return;Ca=!0;const n=q("ol",{class:"test-log","aria-live":"polite"});Es.body.innerHTML="",Es.body.append(n);const s=(r,o="info")=>{n.append(q("li",{class:`test-step is-${o}`,text:r})),n.lastElementChild?.scrollIntoView({block:"nearest"})};try{s("[M0] Worker & WASM roundtrip");try{const o=await new Promise((a,l)=>{const c=window.setTimeout(()=>{i.removeEventListener("message",h),l(new Error("timed out after 5 s"))},5e3),h=u=>{u.data?.type==="WASM_ROUNDTRIP_RESPONSE"&&u.data.requestId==="gate-test"&&(window.clearTimeout(c),i.removeEventListener("message",h),a({wasmResponse:u.data.payload.wasmResponse,latency:Date.now()-u.data.payload.timestamp}))};i.addEventListener("message",h),i.postMessage({type:"WASM_ROUNDTRIP",payload:{message:"Gate Test Ping"},requestId:"gate-test"})});s(`Pass — WASM roundtrip "${o.wasmResponse}" (${o.latency} ms)`,"pass")}catch(o){s(`Fail — WASM roundtrip: ${o.message}`,"fail")}s("[M0] Local server GFN2-xTB job");try{const o=await fetch("/api/xtb/trivial-test",{method:"POST",headers:{"Content-Type":"application/json",Authorization:e?`Bearer ${e}`:""}});if(o.ok){const a=await o.json();s(`Pass — ${a.species} energy = ${Number(a.energy_hartree).toFixed(6)} Eh (${a.method}, ${a.runtime_sec}s)`,"pass")}else s(`Fail — xTB request returned status ${o.status} (is the local server running?)`,"fail")}catch(o){s(`Fail — xTB server call: ${o.message}`,"fail")}s("[M1] Chemical import database");try{const o=await Eo();s(`Pass — import database active with ${Object.keys(o).length} species`,"pass")}catch(o){s(`Fail — ${o.message}`,"fail")}s("[M2] Data bundle v1 & conflict report");try{const o=await fetch("/data/conflict_report.json");if(o.ok){const a=await o.json();s(`Pass — ${a.conflicts_resolved}/${a.spot_checked_conflicts_analyzed} conflicts resolved`,"pass"),s(`Pass — ${a.total_species_in_database} species mapped by InChIKey`,"pass")}else s("Fail — could not load conflict_report.json","fail")}catch(o){s(`Fail — ${o.message}`,"fail")}s("[M5] Optics, catalog, speciation & conservation");try{const o=await t.getOpticsTables();s(`Pass — optics tables: ${o.n_bins} wavelength bins (400–710 nm)`,"pass");const a=await t.getReagentCatalog();s(`Pass — reagent catalog: ${a.length} reagents`,"pass");const l=`selftest_${Date.now()}`;await t.createVessel(l,{type:"beaker-250",capacity_ml:250,glass_mass_g:110,inner_radius_cm:3.5});try{await t.dose(l,{reagent_id:"hcl_0_1m",volume_ml:25}),await t.dose(l,{reagent_id:"naoh_0_1m",volume_ml:25});const c=await t.fetchSnapshot(l);c&&c.ph!==null?(s(`Pass — 25 mL 0.1 M HCl + 25 mL 0.1 M NaOH: pH ${c.ph.toFixed(2)}, ${c.total_liquid_ml.toFixed(1)} mL`,"pass"),s(`Pass — charge balance error ${c.conservation.charge_err_mol.toExponential(2)} mol`,"pass")):s("Fail — no aqueous phase after titration","fail")}finally{await t.freeVessel(l)}}catch(o){s(`Fail — ${o.message}`,"fail")}const r=n.querySelectorAll(".is-fail").length;s(r===0?"All gates passed.":`${r} check(s) failed.`,r===0?"pass":"fail")}finally{Ca=!1}}const Yr=new Worker(new URL("/assets/simulation.worker-Rz28VYrf.js",import.meta.url),{type:"module"});let Ra=new URLSearchParams(window.location.search).get("token")||"";const dy=8,fy=new Set(["stopper_pop","ignition","flame_out","boil_over","dry_out","splatter"]);function jn(i){return i instanceof Error?i.message:String(i)}function Zh(i,t,e){return new Promise((n,s)=>{const r=window.setTimeout(()=>s(new Error(`${e} timed out`)),t);i.then(o=>{window.clearTimeout(r),n(o)},o=>{window.clearTimeout(r),s(o)})})}async function py(){const i=document.getElementById("app"),t=document.getElementById("bench-container"),e=document.getElementById("loading"),n=document.getElementById("loading-detail"),s=D=>n.textContent=D,r=new xx(t),o=new bx(Yr),a=new Nx,l=new To(r,o);let c=null;const h=new oy,u=new ly,d=new cy,f=new Qx([{label:"Import from PubChem",hint:"Search box",icon:"cloud",action:()=>_.focusSearch()},{label:"Custom chemistry…",icon:"plus",action:()=>u.show()},{label:"Run self-test",icon:"test",action:()=>uy(Yr,o,Ra)}]);f.onToggleDetails=()=>h.toggle(),h.onVisibilityChange=D=>f.setDetailsOpen(D);const g=new ny({vessels:()=>l.list(),freeCapacityMl:D=>l.freeCapacityMl(D),isBroken:D=>!!l.snapshot(D)?.burst,catalogMatchFor:D=>D.kind==="imported"?a.catalogMatchFor(D.bottle):void 0}),_=new ey(a,g),m=()=>{const D=r.instruments,N=l.selectedId?l.snapshot(l.selectedId):void 0,j=(it,ut)=>{try{return it()??ut}catch{return ut}};return{temperature:j(()=>D?.thermometer?.readout().formatted,N?`${(N.temperature_k-273.15).toFixed(1)} °C`:"—"),ph:j(()=>D?.phMeter?.readout().formatted,N?.ph!=null?N.ph.toFixed(2):"—"),mass:j(()=>D?.balance?.readout().formatted,N?`${N.contents_mass_g.toFixed(2)} g`:"—"),pressure:j(()=>D?.pressureGauge?.readout().formatted,N?`${(N.pressure_atm-1).toFixed(2)} atm (g)`:"—")}},p=new sy({lab:l,readouts:m,focusVessel:D=>r.focusVessel(D),openDetails:()=>h.show()}),x=new ry(o),M=q("div",{class:"sheet-switch",role:"tablist","aria-label":"Panels"}),v=["reagents","vessel"].map(D=>{const N=q("button",{class:"seg-btn",role:"tab",type:"button","aria-selected":"false",text:D==="reagents"?"Reagents":"Vessel"});return N.addEventListener("click",()=>A(D)),M.append(N),N}),A=D=>{i.dataset.sheet=D,v[0].setAttribute("aria-selected",String(D==="reagents")),v[1].setAttribute("aria-selected",String(D==="vessel"))};A("reagents"),_.el.addEventListener("panel-expanded",()=>A("reagents"));const E=q("div",{class:"bottom-dock"}),R=hy("Search for a reagent on the left or click a bottle on the shelf · drag the bench to look around");R&&E.append(R),E.append(x.el),i.append(f.el,_.el,p.el,E,M);const P=new Set,b=D=>{try{if(D.kind==="catalog"){const N=D.entry;r.addReagentBottle(N);const j=cd(N.id);j?r.setBottleContentColor(N.id,j):Yx(o,N,c).then(it=>{it&&r.setBottleContentColor(N.id,it)})}else P.has(D.id)||(r.addBottle(D.bottle),P.add(D.id))}catch(N){console.warn("[Main] shelf placement failed",N)}},y=D=>{b(D),_.setCollapsed(!1),_.setSelected(D.key),A("reagents"),g.show(D,l.selectedId)};_.onSelect=y,g.onClose=()=>_.setSelected(null),g.onProperties=D=>{D.kind==="imported"&&d.showBottle(D.bottle)},g.onUseCatalog=D=>{const N=a.get(`cat:${D.id}`);N&&y(N)},g.onAdd=async(D,N,j)=>{try{const it=await l.addReagent(D,N,j);a.markUsed(D.key),b(D),it==="visual"&&ye(`Poured ${tr(D)} — visual only, nothing reacts.`,"info")}catch(it){ye(`Couldn't add ${tr(D)}: ${jn(it)}`,"error")}},d.onAddToVessel=D=>{const N=a.get(`pc:${D.id}`);N&&y(N)},d.onBottleUpdated=()=>a.persistImported(),_.onImportPubChem=async D=>{try{const N=await Ix(D),j={id:N.inchi_key?`pc_${N.inchi_key.slice(0,14)}`:`pc_${Date.now()}`,cid:N.cid,name:N.name,formula:N.formula,smiles:N.smiles,inchi_key:N.inchi_key,mw:N.mw,sourcedProperties:{mp_c:N.mp_c,bp_c:N.bp_c,density:N.density,solubility:N.solubility},userOverrides:{},color:N.color||"#e8f4fa",ghs:N.ghs||[],remainingMl:500,state:N.physical_state},it=a.addImported(j);y(it),ye(`Imported ${N.name} from PubChem. It's visual only — no reaction data.`,"success")}catch(N){ye(`Couldn't import “${D}” from PubChem: ${jn(N)}`,"error")}},_.onSpawnGlassware=D=>{l.spawn(D).then(N=>l.select(N.id)).catch(N=>ye(`Couldn't add glassware: ${jn(N)}`,"error"))},u.onRegisterCompound=async D=>{try{await o.registerCustomCompound(D);let N=await o.getReagentCatalog();N.some(it=>it.id===D.id)||(N=[...N,D]),a.setCatalog(N);const j=a.get(`cat:${D.id}`);return j&&y(j),ye(`Registered ${D.name}. Find it in Reagents.`,"success"),!0}catch(N){return ye(`Couldn't register the compound: ${jn(N)}`,"error"),!1}},u.onRegisterReaction=async D=>{try{return await o.registerCustomReaction(D),ye(`Registered reaction ${D.id}.`,"success"),!0}catch(N){return ye(`Couldn't register the reaction: ${jn(N)}`,"error"),!1}},l.onSelectionChanged=D=>{p.show(D),g.setDefaultVessel(D);const N=D?l.get(D):void 0;h.setVessel(D,N?.name??"");const j=D?l.snapshot(D):void 0;j&&(h.updateSnapshot(j),x.setClock(j.t_sim_s)),D&&!g.isOpen&&A("vessel")},l.onVesselsChanged=()=>{p.vesselsChanged(),g.vesselsChanged()},l.onControlsChanged=D=>{D===l.selectedId&&p.syncControls()},r.onSelectObject=(D,N)=>{if(D==="vessel")l.select(N),A("vessel");else{const j=a.findByShelfId(N);j&&y(j)}},r.onDeselect=()=>g.hide();const I=new Map,F=new Map,U=new Set;let O=0;o.onSnapshotUpdated=(D,N)=>{const j=l.ingest(D,N);if(!j)return;const it=performance.now(),ut=I.get(D)??it-50;I.set(D,it);const Dt=Math.min(.25,Math.max(.001,(it-ut)/1e3)),$t=r.getGlassware(D);if($t)try{$t.applyVisual(j,Dt,c)}catch(rt){console.warn("[Main] applyVisual failed",rt)}const Q=l.get(D)?.name??"Vessel";j.burst&&!U.has(D)&&(U.add(D),r.triggerBurst(D),ye(`${Q} burst — the pressure was too high.`,"error"));const st=j.events??[],ft=F.get(D)??st.length;if(st.length>ft){const rt=st.slice(ft).filter(Lt=>fy.has(Lt.kind)),Pt=Array.from(new Set(rt.map(Lt=>Lt.kind)));for(const Lt of Pt)ye(`${Q}: ${fd[Lt]??Lt}`,Lt==="ignition"||Lt==="boil_over"?"warning":"info")}if(F.set(D,st.length),D===l.selectedId){try{r.updateInstruments(j,Dt)}catch(rt){console.warn("[Main] updateInstruments failed",rt)}p.update(j),h.updateSnapshot(j),x.setClock(j.t_sim_s)}g.isOpen&&it-O>250&&(O=it,g.refresh())},window.addEventListener("keydown",D=>{if(D.defaultPrevented||ay()||D.metaKey||D.ctrlKey||D.altKey)return;if(D.key==="Escape"){f.menuOpen?f.closeMenu(!0):g.isOpen?g.hide():h.isVisible?h.hide():Xh(D.target)||l.select(null);return}if(Xh(D.target))return;const j=!!D.target.closest?.('button, a, input, select, textarea, [role="menuitem"], [role="tab"]');D.key==="a"||D.key==="A"?(D.preventDefault(),h.toggle()):D.key===" "&&!j?(D.preventDefault(),x.togglePause()):(D.key==="f"||D.key==="F")&&l.selectedId?(D.preventDefault(),r.focusVessel(l.selectedId)):D.key==="/"&&!j&&(D.preventDefault(),_.focusSearch())}),Yr.addEventListener("message",D=>{const{type:N,payload:j}=D.data??{};N==="WASM_READY"?f.setEngineStatus("ok","Ready"):N==="WASM_ROUNDTRIP_RESPONSE"?f.setEngineStatus("ok",`Ready · ${Date.now()-j.timestamp} ms`):N==="WASM_ERROR"&&(f.setEngineStatus("error","Failed to load"),ye("The chemistry engine failed to load. Reload the page to try again.","error"))}),Yr.postMessage({type:"WASM_ROUNDTRIP",payload:{message:"Reaction Chamber heartbeat"},requestId:"init-ping"}),fetch("/api/health").then(D=>f.setServerStatus(D.ok?"ok":"warn",D.ok?"Online":"Not running (optional)")).catch(()=>f.setServerStatus("warn","Not running (optional)")),Ra||fetch("/api/session-token").then(D=>D.ok?D.json():null).then(D=>{D?.token&&(Ra=D.token)}).catch(()=>{}),Eo().catch(()=>{}),s("Loading the chemistry engine…");try{c=await Zh(o.getOpticsTables(),2e4,"Loading optics tables"),r.setOpticsTables(c)}catch(D){console.warn("[Main] optics tables unavailable",D)}s("Stocking the reagent shelf…");try{a.setCatalog(await Zh(o.getReagentCatalog(),2e4,"Loading the reagent catalog"))}catch(D){ye(`Couldn't load reagents: ${jn(D)}`,"error")}const V=a.recentItems();(V.length?V:a.search("","all",dy).items).slice().reverse().forEach(b),s("Setting out glassware…");try{const D=await l.spawn("beaker-250");l.moveToHotPlate(D.id),await l.spawn("cylinder-100"),await l.spawn("erlenmeyer-250"),l.select(D.id)}catch(D){ye(`Couldn't set out glassware: ${jn(D)}`,"error")}e.classList.add("is-done"),window.setTimeout(()=>e.remove(),400)}window.addEventListener("DOMContentLoaded",()=>{py().catch(i=>{console.error("[Main] startup failed",i);const t=document.getElementById("loading-detail");t&&(t.textContent=`Startup failed: ${jn(i)}`)})});

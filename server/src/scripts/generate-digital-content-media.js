'use strict';
const fs = require('node:fs/promises'), path = require('node:path'), {execFileSync} = require('node:child_process');
const {BATCH,catalog} = require('../simulation/content-plan');
const colors = { politics: ['#13243b','#5ccbb3'], social: ['#33213f','#f3a7b0'], art: ['#202142','#e2b66e'], sports: ['#122f29','#8bd287'] };
const escape = s => s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function graphic(entry,i) {
 const [bg,fg] = colors[entry.category];
 let shape;
 if(entry.category==='sports') shape='<rect x="130" y="500" width="460" height="660" rx="20" fill="none" stroke="'+fg+'" stroke-width="8"/><path d="M130 830H590" stroke="'+fg+'" stroke-width="6"/><circle cx="360" cy="830" r="75" fill="none" stroke="'+fg+'" stroke-width="6"/><circle cx="'+(210+i*7%300)+'" cy="'+(650+i*13%350)+'" r="28" fill="white"/>';
 else if(entry.category==='politics') shape=Array.from({length:6},(_,j)=>'<rect x="'+(70+j*95)+'" y="'+(650+(j*47+i*11)%160)+'" width="72" height="'+(450-(j*47+i*11)%160)+'" rx="12" fill="'+fg+'" opacity="'+(0.35+j*0.1)+'"/>').join('');
 else if(entry.category==='social') shape='<circle cx="270" cy="760" r="120" fill="'+fg+'" opacity=".8"/><circle cx="460" cy="900" r="120" fill="'+fg+'" opacity=".4"/><path d="M190 1040Q360 1160 550 1020" fill="none" stroke="white" stroke-width="14" stroke-linecap="round"/>';
 else shape=Array.from({length:8},(_,j)=>'<circle cx="'+(100+(j*83+i*17)%510)+'" cy="'+(550+(j*91+i*29)%560)+'" r="'+(35+j*8)+'" fill="'+fg+'" opacity="'+(0.2+j*0.08)+'"/>').join('');
 return '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280"><rect width="720" height="1280" fill="'+bg+'"/><circle cx="620" cy="90" r="160" fill="'+fg+'" opacity=".12"/><text x="360" y="180" text-anchor="middle" fill="white" font-size="42" font-family="Noto Sans Arabic, sans-serif" direction="rtl">'+escape(entry.title)+'</text><text x="360" y="255" text-anchor="middle" fill="'+fg+'" font-size="28" font-family="Noto Sans Arabic, sans-serif" direction="rtl">شنو منو • مساحة للمحتوى والنقاش</text>'+shape+'<text x="360" y="1210" text-anchor="middle" fill="white" opacity=".65" font-size="22" font-family="Noto Sans Arabic, sans-serif" direction="rtl">أفكار • فن • مجتمع • رياضة</text></svg>';
}
async function main() {
 const root=process.argv[2];if(!root)throw Error('Output directory required');
 const dir=path.join(root,BATCH);await fs.mkdir(dir,{recursive:true});
 for(let i=0;i<catalog.length;i++)await fs.writeFile(path.join(dir,'card-'+i+'.svg'),graphic(catalog[i],i));
 for(let i=0;i<12;i++) {
  const frame=path.join(dir,'frame-'+i+'.png'),out=path.join(dir,'reel-'+i+'.mp4');
  execFileSync('rsvg-convert',['-o',frame,path.join(dir,'card-'+(i*3+2)+'.svg')],{stdio:'pipe'});
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-loop','1','-i',frame,'-vf',"zoompan=z='min(zoom+0.0006,1.12)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=160:s=720x1280:fps=20",'-t','8','-c:v','libx264','-preset','veryfast','-crf','26','-pix_fmt','yuv420p','-movflags','+faststart',out],{stdio:'pipe'});
  await fs.unlink(frame);
 }
 console.log(JSON.stringify({batch:BATCH,cards:40,reels:12}));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={graphic};

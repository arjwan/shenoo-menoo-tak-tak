'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
async function generateAssets(plan,root) {
  const dir=path.join(root,plan.batch);await fs.mkdir(dir,{recursive:true});
  for(let i=0;i<plan.count;i++) {
    const hue=i*137.508%360;
    const avatar=`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" rx="60" fill="hsl(${hue},60%,85%)"/><path d="M35 256Q30 155 128 155Q226 155 221 256" fill="hsl(${hue},65%,35%)"/><circle cx="128" cy="100" r="55" fill="hsl(${(hue+40)%360},45%,72%)"/><circle cx="108" cy="100" r="5"/><circle cx="148" cy="100" r="5"/><path d="M110 125Q128 ${135+i%10} 146 125" fill="none" stroke="#542b26" stroke-width="4"/><text x="128" y="235" text-anchor="middle" font-size="16" fill="white">${i+1}</text></svg>`;
    const image=`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720"><rect width="720" height="720" fill="hsl(${hue},60%,85%)"/><circle cx="${100+i%500}" cy="180" r="90" fill="hsl(${(hue+70)%360},70%,60%)"/><path d="M0 650L180 ${250+i%100}L420 550L550 350L720 650Z" fill="hsl(${hue},55%,35%)"/><text x="360" y="690" text-anchor="middle" font-size="28" fill="white">${i+1}</text></svg>`;
    await fs.writeFile(path.join(dir,`avatar-${i}.svg`),avatar);
    await fs.writeFile(path.join(dir,`image-${i}.svg`),image);
  }
  for(let i=0;i<8;i++) execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i',`color=c=0x${(0x336699+i*0x090503).toString(16)}:s=360x640:d=3:r=15`,'-vf',`drawbox=x=${30+i*25}:y=${80+i*40}:w=100:h=100:color=white:t=fill,hue=h=t*30`,'-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',path.join(dir,`reel-${i}.mp4`)],{stdio:'pipe'});
  return dir;
}
module.exports={generateAssets};

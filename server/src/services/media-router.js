const path=require('path');

const GROUPS={
 image:new Set(['.jpg','.jpeg','.png','.webp','.gif','.avif','.heic','.heif']),
 audio:new Set(['.mp3','.m4a','.aac','.wav','.flac','.opus','.oga','.ogg','.amr']),
 video:new Set(['.mp4','.m4v','.mov','.webm','.ogv','.3gp','.3g2','.mkv','.avi','.mpeg','.mpg','.ts','.mts','.m2ts','.flv','.wmv','.asf','.vob','.f4v','.ogm'])
};
const DIRECT_VIDEO=new Set(['.mp4','.m4v','.webm','.mov']);
const MAX={image:40*1024*1024,audio:300*1024*1024,video:1024*1024*1024};
function classify({name='',mime=''}){const ext=path.extname(String(name)).toLowerCase();const m=String(mime).toLowerCase();let type='';if(m.startsWith('image/'))type='image';else if(m.startsWith('audio/'))type='audio';else if(m.startsWith('video/'))type='video';else for(const [k,set] of Object.entries(GROUPS))if(set.has(ext)){type=k;break;}if(!type||!GROUPS[type].has(ext))throw Error('نوع الميديا غير مدعوم');return{type,ext,mime:m||'application/octet-stream'};}
function route({name,mime,size,category,userId}){if(!['posts','reels','stories'].includes(String(category)))throw Error('قسم الميديا غير صالح');const c=classify({name,mime});const bytes=Number(size||0);if(!(bytes>0&&bytes<=MAX[c.type]))throw Error(`حجم ${c.type==='video'?'الفيديو':c.type==='audio'?'الصوت':'الصورة'} غير صالح أو أكبر من الحد المسموح`);const processing=c.type==='video'&&!DIRECT_VIDEO.has(c.ext);const owner=String(userId||'user').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,64)||'user';const d=new Date();const ym=`${d.getUTCFullYear()}/${String(d.getUTCMonth()+1).padStart(2,'0')}`;return{...c,bytes,processing,route:`${category}/${c.type}/${ym}/${owner}`,policy:processing?'video-transcode':'direct-r2'};}
module.exports={route,classify,MAX};

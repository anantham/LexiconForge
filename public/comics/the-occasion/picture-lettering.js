'use strict';
// Typography stays editable and follows the painted device planes. No external UI/data.
window.PictureLettering = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const finite = values => Array.isArray(values) && values.every(Number.isFinite);
  function plane(p) {
    if (!p || !finite(p.origin) || !finite(p.xAxis) || !finite(p.yAxis)) return null;
    if ([p.origin,p.xAxis,p.yAxis].some(a=>a.length!==2)) return null;
    return `matrix(${p.xAxis[0]} ${p.xAxis[1]} ${p.yAxis[0]} ${p.yAxis[1]} ${p.origin[0]} ${p.origin[1]})`;
  }
  function render(panel, copies=panel.copy) {
    const surfaces=panel.surfaces||{}, size=panel.imageSize;
    if (!finite(size) || size.length!==2 || size.some(n=>n<=0)) return '';
    const groups=Object.entries(surfaces).map(([id,s])=>{
      const transform=plane(s); if(!transform)return '';
      let graphics='';
      if(s.graphic==='qr-illustration'){
        // Deliberately incomplete finder structure; this is not a functional QR payload.
        graphics='<rect x="12" y="65" width="76" height="76" fill="#eee9d8"/>';
        [[17,70],[65,70]].forEach(([x,y])=>{graphics+=`<rect x="${x}" y="${y}" width="18" height="18" fill="#24332e"/><rect x="${x+4}" y="${y+4}" width="10" height="10" fill="#eee9d8"/><rect x="${x+7}" y="${y+7}" width="4" height="4" fill="#24332e"/>`;});
        for(let y=0;y<8;y++)for(let x=0;x<10;x++)if((x*7+y*11)%5<2)graphics+=`<rect x="${19+x*6}" y="${92+y*5}" width="4" height="4" fill="#24332e"/>`;
      }
      if(s.graphic==='delivery-offer')graphics='<path d="M16 89 H214" stroke="#65716e" stroke-width="1"/><rect x="12" y="204" width="204" height="54" rx="8" fill="#d9b75b"/>';
      if(s.graphic==='video')graphics='<rect x="16" y="14" width="128" height="84" rx="5" fill="#607e88"/><path d="M68 34 L68 76 L100 55 Z" fill="#dfe8df"/>';
      const lettering=(copies||[]).filter(c=>c.decision!=='cut'&&c.surface?.id===id).map(c=>{
        const t=c.surface;if(!finite([t.x,t.y,t.size])||t.size<=0)return '';
        const lines=(t.lines&&c.text===c.originalSurfaceText)?t.lines:[c.text];
        return `<text x="${t.x}" y="${t.y}" fill="${esc(t.color||s.color||'#e9eddc')}" font-family="${panel.id.startsWith('v5-')?'Arial,sans-serif':'ui-monospace,monospace'}" font-size="${t.size}" text-anchor="${t.align==='middle'?'middle':'start'}">${lines.map((line,i)=>`<tspan x="${t.x}" font-size="${Number.isFinite(t.lineSizes?.[i])?t.lineSizes[i]:t.size}" dy="${i?t.size*1.4:0}">${esc(line)}</tspan>`).join('')}</text>`;
      }).join('');
      return `<g transform="${transform}">${graphics}${lettering}</g>`;
    }).join('');
    return groups?`<svg class="surface-lettering" viewBox="0 0 ${size[0]} ${size[1]}" preserveAspectRatio="none" aria-hidden="true">${groups}</svg>`:'';
  }

  // Coordinates refer to the displayed crop, not the raster. Copy indices are stable
  // notebook identities. Grouping affects layout only; story.json stays untouched.
  const top=(x,y,width,indexes=[0])=>({x,top:y,width,indexes});
  const bottom=(x,y,width,indexes=[0])=>({x,bottom:y,width,indexes});
  const layouts={
    '1.1':[top(5,5,85)], '1.3':[bottom(5,5,88)],
    '2.2':[bottom(5,5,88)], '2.3':[top(5,5,90)],
    '4.1':[bottom(4,5,76)], '5.2':[bottom(5,5,76)],
    '6.1':[bottom(4,5,82)], '6.2':[{...top(5,7,43),kind:'speech'}],
    '8.1':[top(5,5,88)], '8.2':[bottom(5,5,88)], '9.1':[top(5,5,40)],
    '11.1':[bottom(55,7,41)], '11.2':[bottom(44,7,52)],
    '12.1':[top(5,5,35),bottom(5,5,90,[1,2])],
    '13.1':[bottom(4,5,88)], '13.2':[bottom(4,5,72)],
    '13.3':[top(48,5,48)], '14.1':[bottom(5,5,90)],
    '14.2':[bottom(5,5,70)], '15.1':[top(56,7,40)],
    '15.2':[bottom(35,5,61)], '16.1':[bottom(4,5,90)],
    '16.2':[top(57,6,39)], '17.2':[bottom(5,5,90)],
    '18.1':[bottom(4,5,72)], '18.2':[bottom(4,5,80)],
    '19.1':[top(5,5,35,[1]),bottom(5,5,72,[0])],
    '20.1':[top(5,5,35,[0]),bottom(5,5,72,[1])],
    '21.1':[top(4,5,78)], '21.2':[bottom(4,5,85)],
    '22.1':[top(36,5,60)], '22.2':[bottom(4,5,92)],
    '23.1':[bottom(4,5,92)], '23.2':[bottom(4,5,92)],
    '24.1':[bottom(4,5,70)], '25.1':[top(4,5,90)],
    '25.2':[top(4,5,90)], '26.1':[top(50,5,46)],
    '26.2':[top(4,5,65)], '26.3':[top(4,5,40,[0]),bottom(4,5,50,[1])],
    '28.1':[top(4,5,65)], '29.1':[top(4,5,51)],
    '30.1':[top(4,5,63)], '31.1':[top(4,5,48)],
    '32.1':[bottom(4,5,72)], '33.1':[top(4,5,43)],
    '33.4':[bottom(4,5,85)], '34.1':[bottom(4,5,80)],
    '35.1':[top(32,5,64)], '36.1':[bottom(4,5,92)],
    '36.2':[top(4,5,74)], '37.1':[top(5,5,72)],
    '39.1':[bottom(4,5,85)], '41.3':[top(5,5,35)]
  };
  const fonts={serif:'Georgia',sans:'Trebuchet MS',mono:'Monospace'};
  const active=c=>c&&c.decision!=='cut'&&!c.surface&&!!c.text?.trim();
  function fontFor(c){return Object.hasOwn(fonts,c.font)?c.font: ['machine'].includes(c.register)?'mono':['place','feed','name','model','device'].includes(c.register)?'sans':'serif';}
  function groupsFor(panel,copies=panel.copy){
    const used=new Set();
    const groups=(panel.letteringLayout||layouts[panel.id]||[]).map(g=>({...g,indexes:g.indexes.filter(i=>{if(!active(copies[i])||used.has(i))return false;used.add(i);return true;})})).filter(g=>g.indexes.length);
    const extra=copies.map((c,i)=>active(c)&&!used.has(i)?i:null).filter(i=>i!==null);
    if(extra.length)groups.push({...bottom(5,5,90,extra),fallback:true});
    return groups;
  }
  function defaultFont(panel,index,copies=panel.copy){
    const copy=copies[index]||{},group=groupsFor(panel,copies).find(g=>g.indexes.includes(index));
    return Object.hasOwn(fonts,copy.font)?copy.font:group?.kind==='speech'?'sans':fontFor(copy);
  }
  function overflowGroups(stage){
    const bounds=stage.getBoundingClientRect(),groups=[...stage.querySelectorAll('.lettering-group')],boxes=groups.map(g=>g.getBoundingClientRect());
    return groups.filter((g,i)=>{const r=boxes[i];return r.top<bounds.top-1||r.bottom>bounds.bottom+1||r.left<bounds.left-1||r.right>bounds.right+1||boxes.some((b,j)=>j!==i&&r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top);});
  }
  function narration(panel,copies=panel.copy){
    const groups=groupsFor(panel,copies||[]);
    if(!groups.length)return '';
    return `<div class="lettering-layer" aria-hidden="true">${groups.map(g=>`<div class="lettering-group${g.kind==='speech'?' speech':''}" style="left:${g.x}%;${g.top!==undefined?'top:'+g.top:'bottom:'+g.bottom}%;max-width:${g.width}%">${g.indexes.map(i=>{const c=copies[i],role=['place','her','teller','machine','feed','name','model'].includes(c.register)?c.register:'teller';return `<p class="lettering-copy ${role} font-${defaultFont(panel,i,copies)}" data-copy-index="${i}">${esc(c.text)}</p>`;}).join('')}</div>`).join('')}</div>`;
  }
  function transcript(panel,copies=panel.copy){return groupsFor(panel,copies||[]).flatMap(g=>g.indexes.map(i=>copies[i].text)).join(' ');}
  // Shared CSS ships with the renderer so reader, desk and lightbox cannot drift.
  const css=`
    .picture-window,.image-stage{container-type:inline-size}
    .lettering-layer{position:absolute;inset:0;z-index:3;pointer-events:none;text-align:left}
    .lettering-group{position:absolute;width:max-content;padding:clamp(7px,1.4cqw,13px) clamp(9px,1.8cqw,17px);background:#f4eddbf5;color:#292c27;box-shadow:0 1px 1px #151a1826;box-sizing:border-box}
    .lettering-group .lettering-copy{font:clamp(.875rem,2.65cqw,1.4375rem)/1.3 Georgia,serif;letter-spacing:0;text-transform:none;margin:0;overflow-wrap:anywhere;text-wrap:pretty}
    .lettering-group .lettering-copy + .lettering-copy{margin-top:.4em}
    .lettering-group .font-serif{font-family:Georgia,'Times New Roman',serif}
    .lettering-group .font-sans{font-family:'Trebuchet MS',Arial,sans-serif}
    .lettering-group .font-mono{font-family:ui-monospace,'Courier New',monospace}
    .lettering-group .teller.font-serif{font-style:italic}
    .lettering-group .place{font-size:clamp(.6875rem,1.65cqw,.9375rem);line-height:1.4;letter-spacing:.07em;text-transform:uppercase}
    .lettering-group:has(.machine){background:#20332ff5;color:#f4f0df}
    .lettering-group .machine{font-size:clamp(.75rem,2cqw,1.125rem)}
    .lettering-group.speech{border:1px solid #303a31;border-radius:45%;padding:clamp(10px,2cqw,20px) clamp(14px,2.4cqw,25px);background:#fcf6e7;text-align:center}
    .lettering-group.speech:after{content:'';position:absolute;right:3%;bottom:-11px;width:19px;height:19px;background:#fcf6e7;border-right:1px solid #303a31;transform:skew(28deg) rotate(40deg);clip-path:polygon(0 0,100% 0,100% 100%)}
    .lettering-group[data-overflow=true]{outline:2px dashed #b25830}
    .lettering-font{display:block;width:100%;margin:6px 0 12px;font:13px/1.5 sans-serif;padding:6px;background:#fffef7;color:#293a30;border:1px solid #bdcbb6}
    .lettering-feedback:empty{padding:0;border:0;margin:0}
    .lettering-hidden{visibility:hidden}
    .lettering-feedback{padding:8px 10px;border-left:2px solid #b25830;color:#754122!important}
  `;
  if(typeof document!=='undefined'&&document.head){const style=document.createElement('style');style.id='picture-lettering-styles';style.textContent=css;document.head.append(style);}
  return {render,narration,transcript,fontFor,defaultFont,fonts,groupsFor,overflowGroups};
})();

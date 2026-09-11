/* ---------- data ---------- */
// Meridia: 5 x 5 precincts, 100,000 people each. Value = % of voters who support the Ridge Party.
const RIDGE = [[36,41,45,48,42],[41,57,64,61,43],[46,70,81,72,48],[43,62,68,58,45],[36,39,47,52,41]];
const N = 5, GRID = {x0:-99.5, y1:40, size:0.4};
const DCOL = ['#FFFFFF','#6B4FBB','#8A9A2B','#C74A7E','#3B7DD8','#A0693A'];
const RIDGE_C = '#0F7C84', VALLEY_C = '#D3781A';
const CD_LAYER_URL = 'https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/USA_119th_Congressional_Districts/FeatureServer/0';
const CD_ITEM_URL = 'https://www.arcgis.com/home/item.html?id=dd86c378a5d94483be9cb25996d873a4';
const VALLEY_SOLUTION = [1,1,1,1,2, 3,3,1,2,2, 3,4,4,4,2, 3,4,5,4,2, 3,5,5,5,5];
const LEVELS = [
  {id:'learn',   title:'Learn the words',        pts:0},
  {id:'fair',    title:'Draw a fair map',        pts:30},
  {id:'rig',     title:'Gerrymander it',         pts:40},
  {id:'explore', title:'Explore real districts', pts:15},
  {id:'quiz',    title:'Quick quiz',             pts:15},
];

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const el = (tag, attrs={}, html='') => { const e=document.createElement(tag); for(const k in attrs){ if(k==='class') e.className=attrs[k]; else e.setAttribute(k,attrs[k]); } e.innerHTML=html; return e; };
const ridgeAt = i => RIDGE[Math.floor(i/N)][i%N];
function neighbors(i){ const r=Math.floor(i/N), c=i%N, o=[]; if(r>0)o.push(i-N); if(r<N-1)o.push(i+N); if(c>0)o.push(i-1); if(c<N-1)o.push(i+1); return o; }
function evaluate(assign){
  const d=[];
  for(let k=1;k<=5;k++){
    const cells=assign.map((v,i)=>v===k?i:-1).filter(i=>i>=0);
    let contiguous=cells.length>0;
    if(cells.length>1){ const seen=new Set([cells[0]]), q=[cells[0]]; while(q.length){ const x=q.pop(); for(const n of neighbors(x)) if(assign[n]===k&&!seen.has(n)){seen.add(n);q.push(n);} } contiguous=seen.size===cells.length; }
    const ridge=cells.length?cells.reduce((a,i)=>a+ridgeAt(i),0)/cells.length:0;
    d.push({k,count:cells.length,contiguous,ridge,winner:cells.length===5?(ridge>50?'ridge':'valley'):null});
  }
  const unassigned=assign.filter(v=>v===0).length;
  return {d, unassigned, valid: unassigned===0 && d.every(x=>x.count===5&&x.contiguous),
    ridgeSeats:d.filter(x=>x.winner==='ridge').length, valleySeats:d.filter(x=>x.winner==='valley').length};
}
function cellRing(i){ const r=Math.floor(i/N), c=i%N, s=GRID.size, x=GRID.x0+c*s, y=GRID.y1-r*s; return [[x,y],[x+s,y],[x+s,y-s],[x,y-s],[x,y]]; }
const cellLabel = i => { const v=ridgeAt(i); return v>50?`R ${v}%`:`V ${100-v}%`; };
const cellLabelColor = i => ridgeAt(i)>50?RIDGE_C:VALLEY_C;

/* ---------- state ---------- */
const state = {level:0, points:0, done:{}, assign:new Array(25).fill(0), brush:1, explored:[], fails:0, solutionShown:false, quiz:null};
function save(){ try{ localStorage.setItem('dtl_state', JSON.stringify({points:state.points,done:state.done,explored:state.explored,quiz:state.quiz})); }catch(e){} }
function load(){ try{ const s=JSON.parse(localStorage.getItem('dtl_state')||'null'); if(s) Object.assign(state,s); }catch(e){} }
function award(id,pts){ if(state.done[id]!=null) return; state.done[id]=pts; state.points=Object.values(state.done).reduce((a,b)=>a+b,0); $('#points').textContent=state.points; save(); renderRail(); }

/* ---------- renderers: ArcGIS Online map, or SVG fallback ---------- */
let R=null, cellCb=()=>{}, districtCb=()=>{};

function makeSvgRenderer(){
  const host=$('#svg-host'); host.style.display='flex';
  const grid=document.createElementNS('http://www.w3.org/2000/svg','svg'); grid.setAttribute('viewBox','0 0 500 500'); grid.setAttribute('role','img'); grid.setAttribute('aria-label','Meridia precincts');
  const none=el('div',{class:'msg',style:'max-width:520px'},`<b>The real-district explorer needs ArcGIS Online.</b><p class="small">This page could not reach js.arcgis.com. Open the layer in ArcGIS Online instead: <a href="${CD_ITEM_URL}" target="_blank" rel="noopener">USA 119th Congressional Districts</a>.</p>`);
  let painting=false;
  const hit=ev=>{ const g=ev.target.closest('g[data-i]'); if(g) cellCb(+g.getAttribute('data-i')); };
  grid.addEventListener('pointerdown',e=>{painting=true;hit(e);}); grid.addEventListener('pointerover',e=>{if(painting)hit(e);}); window.addEventListener('pointerup',()=>painting=false);
  return {
    kind:'svg',
    setMode(m){ host.replaceChildren(m==='grid'?grid:m==='real'?none:el('div')); },
    drawGrid(){
      let out='';
      for(let i=0;i<25;i++){ const x=(i%N)*100, y=Math.floor(i/N)*100;
        out+=`<g data-i="${i}" style="cursor:pointer"><rect x="${x}" y="${y}" width="100" height="100" fill="${DCOL[state.assign[i]]}" stroke="#fff" stroke-width="3"/>
          <text x="${x+50}" y="${y+56}" text-anchor="middle" font-size="18" font-weight="700" fill="${cellLabelColor(i)}" stroke="#fff" stroke-width="4" paint-order="stroke">${cellLabel(i)}</text>
          ${state.assign[i]?`<text x="${x+10}" y="${y+22}" font-size="14" font-weight="700" fill="#fff">D${state.assign[i]}</text>`:''}</g>`; }
      grid.innerHTML=out;
    },
  };
}

async function makeArcgisRenderer(){
  if(!window.$arcgis) throw new Error('SDK not loaded');
  const [GraphicsLayer, Graphic, FeatureLayer, Polygon, Extent] = await $arcgis.import([
    '@arcgis/core/layers/GraphicsLayer.js','@arcgis/core/Graphic.js','@arcgis/core/layers/FeatureLayer.js','@arcgis/core/geometry/Polygon.js','@arcgis/core/geometry/Extent.js']);
  const mapEl=document.createElement('arcgis-map');
  mapEl.setAttribute('basemap','gray-vector'); mapEl.setAttribute('center','-98.5,39'); mapEl.setAttribute('zoom','7'); mapEl.setAttribute('popup-disabled','');
  $('#map-host').appendChild(mapEl);
  await Promise.race([mapEl.viewOnReady(), new Promise((_,rej)=>setTimeout(()=>rej(new Error('view timeout')),25000))]);
  const view=mapEl.view; try{ view.popupEnabled=false; view.background={color:'#FAFAF7'}; }catch(e){}
  const wgs={wkid:4326};
  const gridLayer=new GraphicsLayer(), labelLayer=new GraphicsLayer(), hiLayer=new GraphicsLayer();
  const cdLayer=new FeatureLayer({url:CD_LAYER_URL, outFields:['*'], visible:false, opacity:0.75,
    renderer:{type:'simple', symbol:{type:'simple-fill', color:[47,91,255,0.12], outline:{color:[27,34,48,0.9], width:1}}}});
  view.map.addMany([cdLayer, gridLayer, labelLayer, hiLayer]);
  const gridExtent=new Extent({xmin:-99.5,ymin:38,xmax:-97.5,ymax:40,spatialReference:wgs});
  const usExtent=new Extent({xmin:-125,ymin:24,xmax:-66,ymax:50,spatialReference:wgs});
  const font={size:11, family:'Atkinson Hyperlegible, Arial, sans-serif', weight:'bold'};
  const cellGraphics=[], cellLabels=[];
  for(let i=0;i<25;i++){
    const geom=new Polygon({rings:[cellRing(i)], spatialReference:wgs});
    cellGraphics.push(new Graphic({geometry:geom, attributes:{idx:i}, symbol:{type:'simple-fill', color:'#fff', outline:{color:'#fff', width:1.5}}}));
    cellLabels.push(new Graphic({geometry:geom.centroid, symbol:{type:'text', text:cellLabel(i), color:cellLabelColor(i), haloColor:'#fff', haloSize:1.5, font, verticalAlignment:'middle'}}));
  }
  gridLayer.addMany(cellGraphics); labelLayer.addMany(cellLabels);
  let mode='none';
  view.on('click', async ev=>{
    if(mode==='grid'){
      const res=await view.hitTest(ev,{include:[gridLayer]});
      const hit=res.results.find(r=>r.graphic&&r.graphic.layer===gridLayer);
      if(hit) cellCb(hit.graphic.attributes.idx);
    } else if(mode==='real'){
      const res=await view.hitTest(ev,{include:[cdLayer]});
      const hit=res.results.find(r=>r.graphic&&r.graphic.layer===cdLayer); if(!hit) return;
      const q=await cdLayer.queryFeatures({objectIds:[hit.graphic.attributes[cdLayer.objectIdField]], returnGeometry:true, outFields:['*'], outSpatialReference:view.spatialReference});
      const f=q.features[0]; if(!f) return;
      hiLayer.removeAll(); hiLayer.add(new Graphic({geometry:f.geometry, symbol:{type:'simple-fill', color:[211,120,26,0.25], outline:{color:VALLEY_C, width:2.5}}}));
      districtCb(f.attributes, polsbyPopper(f.geometry.rings));
    }
  });
  return {
    kind:'arcgis',
    setMode(m){
      mode=m; const g=m==='grid', r=m==='real';
      gridLayer.visible=labelLayer.visible=g; cdLayer.visible=hiLayer.visible=r;
      // Meridia is imaginary, so hide the real-world basemap during the drawing missions and bring it back for the real districts.
      view.map.basemap = r ? 'gray-vector' : null;
      if(g) view.goTo(gridExtent.clone().expand(1.12),{animate:false}).catch(()=>{});
      if(r) view.goTo(usExtent,{animate:false}).catch(()=>{});
    },
    drawGrid(){
      for(let i=0;i<25;i++){
        cellGraphics[i].symbol={type:'simple-fill', color:DCOL[state.assign[i]], outline:{color:'#fff', width:1.5}};
        cellLabels[i].symbol={type:'text', text:state.assign[i]?`${cellLabel(i)}\nD${state.assign[i]}`:cellLabel(i), color:cellLabelColor(i), haloColor:'#fff', haloSize:1.5, font, verticalAlignment:'middle', lineHeight:1.15};
      }
    },
  };
}
function polsbyPopper(rings){ let area=0, perim=0; for(const ring of rings){ let a=0; for(let i=0;i<ring.length-1;i++){ const [x1,y1]=ring[i],[x2,y2]=ring[i+1]; a+=x1*y2-x2*y1; perim+=Math.hypot(x2-x1,y2-y1); } area+=a/2; } area=Math.abs(area); return perim>0?4*Math.PI*area/(perim*perim):0; }

/* ---------- screens ---------- */
const panel=$('#panel'), sheet=$('#sheet');
function showSheet(html){ $('#sheet-inner').innerHTML=html; sheet.classList.remove('hidden'); }
function hideSheet(){ sheet.classList.add('hidden'); }
function go(n){ state.level=n; renderRail(); SCREENS[LEVELS[n].id](); window.scrollTo(0,0); }
function nextButton(){ return state.level<LEVELS.length-1?`<button class="primary" onclick="go(${state.level+1})">Next mission</button>`:''; }
function renderRail(){
  const rail=$('#rail'); rail.innerHTML='';
  LEVELS.forEach((L,i)=>{ const b=el('button',{class:(i===state.level?'active ':'')+(state.done[L.id]!=null?'done':'')},`<span class="n">${state.done[L.id]!=null?'✓':i+1}</span><span class="t">${L.title}</span>`); b.onclick=()=>go(i); rail.appendChild(b); });
}

const SCREENS={
  learn(){
    R.setMode('none');
    showSheet(`
      <h2>Draw the Lines</h2>
      <p class="story">The state of <b>Meridia</b> just got a fifth seat in the House after the census. Its old map is out of date, and someone has to draw five new districts. In this game, that someone is you. First you'll draw a fair map, then you'll try to cheat on purpose, then you'll look at real U.S. districts through ArcGIS Online.</p>
      <p class="story">Two parties compete: the <span class="party ridge">Ridge Party</span>, strongest in the city, and the <span class="party valley">Valley Party</span>, strongest in farm country. Statewide, Ridge has about 51% of voters.</p>
      <div class="terms">
        <div class="term"><h3>Electoral district</h3>An area whose voters elect one representative. Meridia gets 5.</div>
        <div class="term"><h3>Redistricting</h3>Redrawing district lines so every district has about the same number of people.</div>
        <div class="term"><h3>Gerrymandering</h3>Drawing lines to favor one party, by <b>packing</b> opponents into one district or <b>cracking</b> them across many.</div>
      </div>
      <button class="primary" onclick="go(1)">Start mission 2</button>`);
    panel.innerHTML=`<h2>How it works</h2><p>Five short missions. Finishing each one earns points, up to 100. The <b>Glossary</b> button at the top is always available.</p><p class="small mute">The map runs on ArcGIS Online. Meridia is imaginary and is drawn on top of the real map.</p>`;
  },
  fair(){ puzzleScreen('fair'); },
  rig(){ puzzleScreen('rig'); },
  explore(){
    hideSheet(); R.setMode('real');
    panel.innerHTML=`
      <h2>Mission 4: Explore real districts</h2>
      <p>These are the real U.S. House districts, streamed live from ArcGIS Online. Zoom in and <b>click any district</b> to see who represents it and its <b>shape score</b> (1.0 = a circle; near 0 = stringy).</p>
      <div id="district-card" class="district-card"><span class="mute">Click a district to inspect it.</span></div>
      <p class="small mute">Click <b>2 districts</b> to finish. A low shape score is a clue worth investigating, not proof of gerrymandering: coastlines and rivers bend lines too.</p>
      <ul class="log" id="explore-log"></ul>
      <div id="explore-msg"></div>
      <div class="row" id="explore-row">${state.done.explore!=null?nextButton():''}</div>
      ${R.kind==='svg'?`<div class="msg warn">The live layer needs ArcGIS Online, which this page could not reach. Look at three districts in <a href="${CD_ITEM_URL}" target="_blank" rel="noopener">ArcGIS Online</a>, then <button class="ghost" onclick="exploreDone()">mark this mission done</button>.</div>`:''}`;
    renderExploreLog();
  },
  quiz(){
    R.setMode('none');
    showSheet(`<h2>Quick quiz</h2>${QUIZ.map((q,i)=>`<div class="q" id="q${i}"><div class="stem">${i+1}. ${q.s}</div>${q.o.map((o,j)=>`<label><input type="radio" name="q${i}" value="${j}"> ${o}</label>`).join('')}<div class="why hidden">${q.w}</div></div>`).join('')}<div id="quiz-msg"></div><button class="primary" onclick="gradeQuiz()">Grade my quiz</button>`);
    panel.innerHTML=`<h2>Mission 5: Quick quiz</h2><p>Four questions. ${state.quiz!=null?`Best so far: <b>${state.quiz}/${QUIZ.length}</b>.`:''}</p><p class="small mute">You can retake it; your best score counts.</p>`;
  },
};

const PUZZLE={
  fair:{title:'Mission 2: Draw a fair map', goal:'Draw 5 districts so the map is legal: each district has <b>exactly 5 precincts</b> (equal population) and is <b>one connected piece</b>.', hint:'Any legal map works. Watch the seat tally change as you paint, even though you are not trying to cheat.', pass:e=>e.valid},
  rig:{title:'Mission 3: Gerrymander it', goal:'The Valley Party hired you. Same voters, same rules. Draw a legal map where <b>Valley wins 4 of 5 seats</b>, even though Ridge has more voters.', hint:'<b>Pack</b> the whole city (the R 60–80% precincts) into one district so Ridge wins it by a landslide and wastes votes. Then <b>crack</b> the leftover Ridge suburbs among the other four districts.', pass:e=>e.valid&&e.valleySeats>=4},
};
function puzzleScreen(id){
  hideSheet(); R.setMode('grid'); state.assign.fill(0); state.brush=1; state.fails=0; state.solutionShown=false;
  const P=PUZZLE[id];
  panel.innerHTML=`
    <h2>${P.title}</h2><p>${P.goal}</p>
    <div class="scoreline"><span>Voters: <b style="color:${RIDGE_C}">Ridge 51%</b> · <b style="color:${VALLEY_C}">Valley 49%</b></span><span>25 precincts</span></div>
    <h3>Brush</h3><div class="brushes" id="brushes"></div>
    <p class="small mute">Pick a district, then click precincts on the map to color them in.</p>
    <h3>Seat tally</h3><div class="tally" id="tally"></div>
    <div class="scoreline"><span id="seat-summary"></span></div>
    <div id="puzzle-msg"></div>
    <div class="row" id="puzzle-row"><button class="primary" onclick="checkPuzzle('${id}')">Check my map</button><button class="ghost" onclick="clearMap()">Clear</button>${state.done[id]!=null?nextButton():''}</div>
    <div class="msg small" style="margin-top:14px">Hint: ${P.hint}</div><div id="solve-row" class="row"></div>`;
  renderBrushes(); R.drawGrid(); renderTally();
  cellCb=i=>{ state.assign[i]=state.brush; R.drawGrid(); renderTally(); };
}
function renderBrushes(){
  const b=$('#brushes'); b.innerHTML='';
  for(let k=1;k<=5;k++){ const x=el('button',{class:'brush'+(state.brush===k?' active':''),style:`background:${DCOL[k]}`,'aria-label':`District ${k}`},`D${k}`); x.onclick=()=>{state.brush=k;renderBrushes();}; b.appendChild(x); }
  const e=el('button',{class:'brush eraser'+(state.brush===0?' active':''),'aria-label':'Eraser'},'✕'); e.onclick=()=>{state.brush=0;renderBrushes();}; b.appendChild(e);
}
let lastWinners=[];
function renderTally(){
  const e=evaluate(state.assign), t=$('#tally'); if(!t) return;
  t.innerHTML=e.d.map(x=>`<div class="seat ${x.winner||''} ${(!x.contiguous&&x.count>1)||x.count>5?'bad':''} ${x.winner&&lastWinners[x.k]!==x.winner?'flip':''}"><div class="lbl"><span class="swatch" style="background:${DCOL[x.k]}"></span>D${x.k}</div><div class="who">${x.winner?(x.winner==='ridge'?'Ridge':'Valley'):`${x.count}/5`}</div><div class="pct">${x.winner?`${Math.round(x.winner==='ridge'?x.ridge:100-x.ridge)}%`:'—'}</div></div>`).join('');
  lastWinners=[null,...e.d.map(x=>x.winner)];
  setTimeout(()=>t.querySelectorAll('.flip').forEach(x=>x.classList.remove('flip')),400);
  $('#seat-summary').innerHTML=`Seats: <b style="color:${RIDGE_C}">Ridge ${e.ridgeSeats}</b> · <b style="color:${VALLEY_C}">Valley ${e.valleySeats}</b>${e.unassigned?` · ${e.unassigned} precincts unassigned`:''}`;
}
function clearMap(){ state.assign.fill(0); R.drawGrid(); renderTally(); $('#puzzle-msg').innerHTML=''; }
function checkPuzzle(id){
  const e=evaluate(state.assign), P=PUZZLE[id], m=$('#puzzle-msg'), problems=[];
  if(e.unassigned) problems.push(`${e.unassigned} precinct${e.unassigned>1?'s are':' is'} not in any district.`);
  e.d.forEach(x=>{ if(!x.count) problems.push(`District ${x.k} has no precincts.`); else if(x.count!==5) problems.push(`District ${x.k} has ${x.count} precincts; it needs exactly 5.`); if(x.count>1&&!x.contiguous) problems.push(`District ${x.k} is broken into separate pieces.`); });
  if(problems.length){ m.innerHTML=`<div class="msg warn"><b>Not legal yet.</b><ul>${problems.map(p=>`<li>${p}</li>`).join('')}</ul></div>`; return; }
  const outcome=`Ridge ${e.ridgeSeats} – Valley ${e.valleySeats}`;
  if(P.pass(e)){
    let pts=LEVELS.find(L=>L.id===id).pts, note='';
    if(state.solutionShown){ pts=Math.round(pts/2); note=' Half points because a solution was revealed.'; }
    award(id,pts);
    const lesson=id==='fair'
      ? `Result: <b>${outcome}</b>. With 51% of the vote, Ridge "should" get about half the seats, and most fair maps land near 3–2. Notice that a legal map is not automatically a neutral one.`
      : `Result: <b>${outcome}</b>. Valley has fewer voters than Ridge, yet wins 4 of 5 seats. Same voters, same rules, different lines. That is why who draws the lines matters.`;
    m.innerHTML=`<div class="msg ok"><b>Mission complete.</b> ${lesson}${note}</div>`;
    $('#puzzle-row').insertAdjacentHTML('beforeend',nextButton());
  } else {
    state.fails++;
    m.innerHTML=`<div class="msg warn"><b>Legal map, but Valley isn't happy:</b> ${outcome}. Try packing more of the teal city precincts into a single district.</div>`;
    $('#solve-row').innerHTML=`<button class="ghost" onclick="revealSolution()">Stuck? Show one solution (half points)</button>`;
  }
}
function revealSolution(){ state.solutionShown=true; state.assign=VALLEY_SOLUTION.slice(); R.drawGrid(); renderTally(); $('#solve-row').innerHTML=''; $('#puzzle-msg').innerHTML=`<div class="msg">One of several solutions. Find the packed district (the one Ridge wins by a landslide), then press Check.</div>`; }

districtCb=(a,pp)=>{
  const name=a.NAME||'Unknown', party=a.PARTY||'', st=a.STATE_ABBR||'', dist=String(a.DISTRICTID||'').slice(-2);
  const label=`${st}${dist?'-'+dist:''}`;
  $('#district-card').innerHTML=`<div class="mute small">${label} · ${party}</div><div><b>${name}</b></div><div class="big">${pp.toFixed(2)}</div><div class="bar"><i style="width:${Math.min(100,pp*100)}%"></i></div><div class="small mute">${pp<0.15?'Very low: an oddly shaped district worth a closer look.':pp<0.3?'Below average: somewhat irregular.':'Fairly compact.'}</div>`;
  if(!state.explored.find(x=>x.label===label)) state.explored.push({label,name,pp:+pp.toFixed(2)});
  save(); renderExploreLog(); if(state.explored.length>=2) exploreDone();
};
function renderExploreLog(){ const l=$('#explore-log'); if(l) l.innerHTML=state.explored.slice(-6).map(x=>`<li><span>${x.label} — ${x.name}</span><b>${x.pp}</b></li>`).join(''); }
function exploreDone(){
  award('explore',15);
  const least=state.explored.length?state.explored.reduce((a,b)=>a.pp<b.pp?a:b):null;
  $('#explore-msg').innerHTML=`<div class="msg ok"><b>Mission complete.</b> ${least?`Least compact so far: <b>${least.label}</b> (${least.pp}).`:''} In most states the legislature draws the lines; some states use independent commissions to limit gerrymandering.</div>`;
  const row=$('#explore-row'); if(row&&!row.innerHTML.trim()) row.innerHTML=nextButton();
}

const QUIZ=[
  {s:'An electoral district is:', o:['A political party\'s home region','The area whose voters elect one representative','A county','A census tract'], a:1, w:'A district is the area that elects a representative; equal-population districts keep each vote roughly equal in weight.'},
  {s:'Redrawing district lines so each district has about the same population is called:', o:['Redistricting','Gerrymandering','Reapportionment','Annexation'], a:0, w:'Redistricting is the redrawing of lines. It happens after each census.'},
  {s:'In mission 3 you put the whole city into one district that Ridge won by a landslide. That tactic is:', o:['Cracking','Packing','Stacking','Splitting'], a:1, w:'Packing concentrates the other side\'s voters so they waste votes winning one seat by a huge margin.'},
  {s:'Spreading the other party\'s voters thinly across several districts so they narrowly lose all of them is:', o:['Packing','Redistricting','Cracking','Apportioning'], a:2, w:'Cracking splits a group so it is outnumbered everywhere.'},
];
function gradeQuiz(){
  let right=0, blank=0;
  QUIZ.forEach((q,i)=>{ const p=document.querySelector(`input[name=q${i}]:checked`), box=$('#q'+i); box.classList.remove('right','wrong'); if(!p){blank++;return;} const ok=+p.value===q.a; if(ok)right++; box.classList.add(ok?'right':'wrong'); box.querySelector('.why').classList.remove('hidden'); });
  const m=$('#quiz-msg');
  if(blank){ m.innerHTML=`<div class="msg warn">${blank} question${blank>1?'s are':' is'} unanswered.</div>`; return; }
  if(state.quiz==null||right>state.quiz){ state.quiz=right; delete state.done.quiz; }
  award('quiz',Math.round(state.quiz/QUIZ.length*15));
  m.innerHTML=`<div class="msg ${right===QUIZ.length?'ok':''}"><b>${right} of ${QUIZ.length} correct.</b> ${right===QUIZ.length?'You finished the game. Your score is in the top bar.':'Read the notes under each question and try again.'}</div>`;
  panel.innerHTML=`<h2>Mission 5: Quick quiz</h2><p>Best score: <b>${state.quiz}/${QUIZ.length}</b>. Total points: <b>${state.points}/100</b>.</p>`;
}

/* ---------- boot ---------- */
$('#btn-glossary').onclick=()=>$('#glossary').classList.toggle('open');
$('#close-glossary').onclick=()=>$('#glossary').classList.remove('open');
$('#btn-reset').onclick=()=>{ if(confirm('Erase saved progress and start over?')){ localStorage.removeItem('dtl_state'); location.reload(); } };
load(); $('#points').textContent=state.points;
window.boot=function(renderer,note){ R=renderer; $('#map-badge').innerHTML=note; renderRail(); go(0); };

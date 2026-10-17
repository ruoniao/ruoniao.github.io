const app=document.querySelector('#mountain-app');
const $=s=>document.querySelector(s);
const base=app.dataset.base;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let data,layout,selected=null,view=null;
const list=$('#knowledge-list'),detail=$('#node-detail'),status=$('#map-status');
const byId=new Map();
function setStatus(message){status.textContent=message;status.hidden=!message}
function openList(value=true){list.hidden=!value;$('#toggle-list').setAttribute('aria-expanded',String(value));if(value&&innerWidth<800)detail.hidden=true}
function safeLink(value){try{const url=new URL(value,location.origin);return ['https:','http:'].includes(url.protocol)?url.href:null}catch{return null}}
function stageFor(node){return data.stages.find(s=>s.value===node.stage)||data.stages[0]}
function ancestors(node){const result=[];const seen=new Set();while(node&&!seen.has(node.id)){seen.add(node.id);result.unshift(node);node=byId.get(node.parent)}return result}
function selectNode(id,focus=false){
 const node=byId.get(id);if(!node)return;selected=node;
 $('#node-title').textContent=node.title;$('#node-description').textContent=node.description;
 $('#node-stage').textContent='掌握阶段：'+stageFor(node).label;
 $('#node-domain').textContent=data.domains.find(d=>d.id===node.domain)?.title||'';
 $('#node-breadcrumb').textContent=ancestors(node).map(n=>n.title).join(' / ');
 const evidence=$('#node-evidence');evidence.replaceChildren();
 for(const item of node.evidence||[]){const url=safeLink(item.url.startsWith('/')?base+item.url.slice(1):item.url);if(!url)continue;const a=document.createElement('a');a.href=url;a.textContent=item.title+' →';evidence.append(a)}
 if(!evidence.children.length){const p=document.createElement('p');p.textContent='暂未关联公开记录。';evidence.append(p)}
 detail.hidden=false;if(innerWidth<800)openList(false);
 history.replaceState({},'',location.pathname+location.search+'#'+encodeURIComponent(id));
 view?.highlight(id);if(focus)view?.focus(id);
}
function renderList(){
 const query=$('#knowledge-search').value.trim().toLowerCase();const domain=$('#domain-filter').value;
 const results=data.nodes.filter(n=>(domain==='all'||n.domain===domain)&&`${n.title} ${n.description}`.toLowerCase().includes(query));
 const container=$('#node-list');container.replaceChildren();
 for(const node of results){const button=document.createElement('button');button.className='node-row';button.append(document.createTextNode(node.title));const span=document.createElement('span');span.textContent=stageFor(node).label;button.append(span);button.addEventListener('click',()=>selectNode(node.id,true));container.append(button)}
 if(!results.length)container.textContent='没有找到匹配的知识点。';
}
async function loadJSON(path){const response=await fetch(base+path);if(!response.ok)throw new Error('无法读取 '+path);return response.json()}
function validate(d,l){
 if(d.version!==1||!Array.isArray(d.nodes)||!Array.isArray(d.domains))throw new Error('不支持的知识数据格式');
 const ids=new Set(),domains=new Set(d.domains.map(x=>x.id)),stages=new Set(d.stages.map(x=>x.value));
 for(const n of d.nodes){if(!n.id||ids.has(n.id)||!domains.has(n.domain)||!stages.has(n.stage)||!n.title)throw new Error('知识节点无效或重复');ids.add(n.id);byId.set(n.id,n)}
 for(const n of d.nodes){const seen=new Set([n.id]);let parent=n.parent;while(parent){if(!ids.has(parent)||seen.has(parent))throw new Error('知识层级存在无效关联或循环');seen.add(parent);parent=byId.get(parent).parent}}
 for(const d of domains){if(!l.domains[d])throw new Error('领域缺少地形配置')}
 for(const e of d.relations||[]){if(!ids.has(e.from)||!ids.has(e.to))throw new Error('关联节点不存在')}
}
try{
 [data,layout]=await Promise.all([loadJSON('assets/data/knowledge.json'),loadJSON('assets/data/knowledge-layout.json')]);validate(data,layout);
 $('#assessment-note').textContent=data.note;
 for(const domain of data.domains){const option=document.createElement('option');option.value=domain.id;option.textContent=domain.title;$('#domain-filter').append(option)}
 for(const stage of data.stages){const span=document.createElement('span'),dot=document.createElement('i');dot.style.setProperty('--stage-color',stage.color);span.append(dot,document.createTextNode(stage.label));$('#map-legend').append(span)}
 renderList();$('#toggle-list').onclick=()=>openList(list.hidden);$('#close-list').onclick=()=>openList(false);
 $('#close-detail').onclick=()=>{detail.hidden=true;$('#terrain').focus()};
 $('#knowledge-search').addEventListener('input',()=>{openList(true);renderList()});$('#domain-filter').onchange=renderList;
 $('#focus-node').onclick=()=>{if(selected)view?.focus(selected.id)};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){openList(false);detail.hidden=true;view?.stop()}});
 const initial=decodeURIComponent(location.hash.slice(1));if(byId.has(initial))selectNode(initial);
 try{view=await createTerrain();setStatus('');if(selected)view.highlight(selected.id)}catch(error){console.error(error);setStatus('三维视图暂不可用，你仍可通过知识目录浏览全部内容。');openList(true);for(const id of ['zoom-in','zoom-out','rotate-map','reset-map','climb','focus-node'])$('#'+id).disabled=true}
}catch(error){console.error(error);setStatus('知识数据加载失败，请刷新重试。');$('#toggle-list').disabled=true;$('#knowledge-search').disabled=true;$('#climb').disabled=true}

async function createTerrain(){
 const THREE=await import('three');const {OrbitControls}=await import('../vendor/three/OrbitControls.js');const {ImprovedNoise}=await import('../vendor/three/ImprovedNoise.js');
 const host=$('#terrain'),labels=$('#map-labels');
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x06101e);host.append(renderer.domElement);
 renderer.domElement.setAttribute('aria-hidden','true');
 const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x06101e,.0018);
 const camera=new THREE.PerspectiveCamera(44,1,.5,800);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.075;controls.minDistance=9;controls.maxDistance=340;controls.maxPolarAngle=Math.PI*.475;controls.minPolarAngle=.14;controls.panSpeed=.75;controls.rotateSpeed=.55;
 const noise=new ImprovedNoise();const peaks=[...Object.values(layout.domains),...layout.distantPeaks];
 for(let i=0;i<22;i++){const x=-150+(i%7)*49,z=-45-Math.floor(i/7)*62;peaks.push({x:x+Math.sin(i*8)*12,z,radius:25+(i%3)*7,height:20+(i*13%40)})}
 function height(x,z){
  let h=0;
  for(const p of peaks){const dx=x-p.x,dz=z-p.z;const r=Math.sqrt(dx*dx+dz*dz);const angle=Math.atan2(dz,dx);const radius=p.radius*(1+.12*Math.sin(angle*5+p.x));const cone=Math.max(0,1-r/(radius*1.85));h=Math.max(h,p.height*Math.pow(cone,2.15))}
  const rough=noise.noise(x*.09,z*.09,3)*.16+noise.noise(x*.24,z*.24,8)*.085+noise.noise(x*.57,z*.57,1)*.045;
  const ridge=Math.abs(noise.noise(x*.035,z*.035,2))*4;
  return Math.max(.1,h*(1+rough)+ridge+noise.noise(x*.4,z*.4,5)*Math.min(1.6,h*.025));
 }
 scene.add(new THREE.AmbientLight(0x8dbbff,1.4));const key=new THREE.DirectionalLight(0x8adfff,1.9);key.position.set(-50,120,70);scene.add(key);const rim=new THREE.DirectionalLight(0x245baa,2);rim.position.set(80,20,-100);scene.add(rim);
 const segments=innerWidth<700?190:300;
 const geo=new THREE.PlaneGeometry(380,380,segments,segments);geo.rotateX(-Math.PI/2);geo.translate(0,0,-55);
 const position=geo.attributes.position;const colors=[];
 for(let i=0;i<position.count;i++){const x=position.getX(i),z=position.getZ(i),h=height(x,z);position.setY(i,h);const c=new THREE.Color().setRGB(.025+h*.0008,.075+h*.0011,.135+h*.0016);colors.push(c.r,c.g,c.b)}
 geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
 const terrain=new THREE.Mesh(geo,new THREE.ShaderMaterial({
   side:THREE.DoubleSide,
   vertexShader:`varying vec3 vN; varying vec3 vV; varying float vH; void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);vN=normalize(normalMatrix*normal);vV=-mv.xyz;vH=position.y;gl_Position=projectionMatrix*mv;}`,
   fragmentShader:`varying vec3 vN; varying vec3 vV; varying float vH; void main(){vec3 n=normalize(vN);float edge=pow(1.0-abs(dot(n,normalize(vV))),2.8);float light=max(0.0,dot(n,normalize(vec3(-0.5,0.8,0.6))));float contour=pow(0.5+0.5*cos(vH*2.6),28.0);vec3 color=vec3(0.018,0.045,0.085)+light*vec3(0.055,0.15,0.24)+edge*vec3(0.32,0.85,1.0)+contour*vec3(0.025,0.10,0.16);float fog=1.0-exp(-length(vV)*0.0018);gl_FragColor=vec4(mix(color,vec3(0.024,0.063,0.118),fog),1.0);}`
  }));scene.add(terrain);
 const wire=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0x71c7ff,wireframe:true,transparent:true,opacity:.22,depthWrite:false}));wire.position.y=.10;scene.add(wire);
 // Real height-field contours remain attached to the terrain as the camera rotates.
 const contours=[];
 for(let i=0;i<position.count;i++){const y=position.getY(i);if(y>4&&Math.abs(y/5-Math.round(y/5))<.025)contours.push(position.getX(i),y+.16,position.getZ(i))}
 const contourGeo=new THREE.BufferGeometry();contourGeo.setAttribute('position',new THREE.Float32BufferAttribute(contours,3));scene.add(new THREE.Points(contourGeo,new THREE.PointsMaterial({color:0x4da8df,size:.25,transparent:true,opacity:.65,sizeAttenuation:true})));
 const dots=[];for(let i=0;i<position.count;i+=37){if(position.getY(i)>6)dots.push(position.getX(i),position.getY(i)+.2,position.getZ(i))}
 const dotsGeo=new THREE.BufferGeometry();dotsGeo.setAttribute('position',new THREE.Float32BufferAttribute(dots,3));scene.add(new THREE.Points(dotsGeo,new THREE.PointsMaterial({color:0x8ac7ff,size:.36,transparent:true,opacity:.7})));
 const coords=new Map(),meshes=[],labelItems=[];
 const hash=s=>[...s].reduce((v,c)=>(v*31+c.charCodeAt(0))>>>0,7);
 for(const domain of data.domains){
  const group=data.nodes.filter(n=>n.domain===domain.id),p=layout.domains[domain.id];const maxDepth=Math.max(...group.map(n=>ancestors(n).length));
  const depths=new Map();for(const n of group){const depth=ancestors(n).length-1;if(!depths.has(depth))depths.set(depth,[]);depths.get(depth).push(n)}
  for(const [depth,siblings] of depths){siblings.sort((a,b)=>a.id.localeCompare(b.id));for(const n of siblings){
   const angle=Math.PI*.35+(hash(n.id)%1000)/1000*1.3;
   const radius=p.radius*Math.max(.12,1.25-.22*depth);
   const override=layout.nodes?.[n.id];
   const x=override?.x??p.x+Math.cos(angle)*radius,z=override?.z??p.z+Math.sin(angle)*radius;
   coords.set(n.id,new THREE.Vector3(x,height(x,z)+1.1,z));
  }}
 }
 const nodeGeo=new THREE.SphereGeometry(.7,12,8);
 for(const n of data.nodes){const mat=new THREE.MeshBasicMaterial({color:stageFor(n).color});const mesh=new THREE.Mesh(nodeGeo,mat);mesh.position.copy(coords.get(n.id));mesh.userData.id=n.id;scene.add(mesh);meshes.push(mesh);
  const glow=new THREE.Mesh(new THREE.SphereGeometry(1.2,12,8),new THREE.MeshBasicMaterial({color:stageFor(n).color,transparent:true,opacity:.12,depthWrite:false}));glow.position.copy(mesh.position);scene.add(glow);
  const label=document.createElement('span');label.className='node-label';label.textContent=n.title;label.addEventListener('click',()=>selectNode(n.id));labels.append(label);labelItems.push({node:n,label,pos:mesh.position});
 }
 function drawPath(from,to,related=false){const a=coords.get(from),b=coords.get(to);if(!a||!b)return;const points=[];for(let k=0;k<=55;k++){const t=k/55;const x=THREE.MathUtils.lerp(a.x,b.x,t),z=THREE.MathUtils.lerp(a.z,b.z,t);points.push(new THREE.Vector3(x,height(x,z)+.8,z))}const line=related?new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x3f718f,transparent:true,opacity:.28})):new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),80,.13,4,false),new THREE.MeshBasicMaterial({color:0x8ce4ff}));scene.add(line)}
 for(const n of data.nodes)if(n.parent)drawPath(n.parent,n.id);for(const e of data.relations||[])drawPath(e.from,e.to,true);
 let tween=null,tour=null,tourIndex=0,nextTourTime=0;
 const vec=new THREE.Vector3(),raycaster=new THREE.Raycaster();const mouse=new THREE.Vector2();let pointerDown=null;
 function move(target,position,duration=1100){tween={start:performance.now(),duration:reduced?0:duration,from:camera.position.clone(),to:position.clone(),oldTarget:controls.target.clone(),target:target.clone()}}
 function stop(){tour=null;tween=null;$('#climb').textContent='沿路径登山';$('#map-hint').textContent=innerWidth<800?'单指旋转 · 双指缩放 / 平移':'拖动旋转 · 右键平移 · 滚轮缩放'}
 function focus(id){stop();const p=coords.get(id);if(p)move(p,p.clone().add(new THREE.Vector3(22,15,30)))}
 function reset(){stop();move(new THREE.Vector3(...layout.camera.target),new THREE.Vector3(...layout.camera.position))}
 function highlight(id){for(const mesh of meshes){const n=byId.get(mesh.userData.id);mesh.material.color.set(mesh.userData.id===id?'#d2f7ff':stageFor(n).color);mesh.scale.setScalar(mesh.userData.id===id?1.6:1)}for(const item of labelItems)item.label.classList.toggle('selected',item.node.id===id)}
 controls.addEventListener('start',stop);
 renderer.domElement.addEventListener('pointerdown',e=>{pointerDown={x:e.clientX,y:e.clientY}});
 renderer.domElement.addEventListener('pointerup',e=>{if(!pointerDown||Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)>5)return;const rect=host.getBoundingClientRect();mouse.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(mouse,camera);const hit=raycaster.intersectObjects(meshes)[0];if(hit){const ground=raycaster.intersectObject(terrain)[0];if(!ground||hit.distance<=ground.distance+1.5)selectNode(hit.object.userData.id)}});
 $('#zoom-in').onclick=()=>{stop();camera.position.lerp(controls.target,.18)};$('#zoom-out').onclick=()=>{stop();camera.position.sub(controls.target).multiplyScalar(1.2).add(controls.target)};
 $('#rotate-map').onclick=()=>{stop();const offset=camera.position.clone().sub(controls.target);offset.applyAxisAngle(new THREE.Vector3(0,1,0),.3);move(controls.target,controls.target.clone().add(offset),450)};$('#reset-map').onclick=reset;
 $('#climb').onclick=()=>{if(tour){stop();return}const destination=selected||byId.get('kv-cache')||data.nodes[data.nodes.length-1];tour=ancestors(destination);tourIndex=0;nextTourTime=0;$('#climb').textContent='结束登山';$('#map-hint').textContent='沿知识路径前进 · 拖动可退出';detail.hidden=true;openList(false)};
 host.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Home'].includes(e.key)){e.preventDefault();if(e.key==='Home')reset();else if(e.key==='+')$('#zoom-in').click();else if(e.key==='-')$('#zoom-out').click();else{stop();const dx=e.key==='ArrowLeft'?-5:e.key==='ArrowRight'?5:0,dz=e.key==='ArrowUp'?-5:e.key==='ArrowDown'?5:0;camera.position.add(new THREE.Vector3(dx,0,dz));controls.target.add(new THREE.Vector3(dx,0,dz))}}});
 function resize(){const {width,height}=host.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix()}new ResizeObserver(resize).observe(host);resize();camera.position.set(...layout.camera.position);controls.target.set(...layout.camera.target);controls.update();
 let frame=0;
 function animate(time){
  requestAnimationFrame(animate);if(document.hidden)return;
  if(tour&&time>=nextTourTime){if(tourIndex<tour.length){const n=tour[tourIndex++],p=coords.get(n.id);highlight(n.id);$('#map-hint').textContent='正在探索：'+n.title;move(p,p.clone().add(new THREE.Vector3(15,12,23)),reduced?0:2000);nextTourTime=time+(reduced?1500:3300)}else if(tourIndex===tour.length){tourIndex++;const p=coords.get(tour[tour.length-1].id);move(new THREE.Vector3(-5,65,-100),p.clone().add(new THREE.Vector3(18,28,45)),2600);$('#map-hint').textContent='抵达一处山顶，也看见更远的群山。';nextTourTime=time+6000}else stop()}
  if(tween){const t=tween.duration===0?1:Math.min(1,(time-tween.start)/tween.duration);const smooth=t*t*(3-2*t);camera.position.lerpVectors(tween.from,tween.to,smooth);controls.target.lerpVectors(tween.oldTarget,tween.target,smooth);if(t===1)tween=null}
  camera.position.y=Math.max(camera.position.y,height(camera.position.x,camera.position.z)+3);
  controls.update();renderer.render(scene,camera);
  if(frame++%5===0){const occupied=[];const sorted=[...labelItems].sort((a,b)=>Number(b.node.id===selected?.id)-Number(a.node.id===selected?.id)||Number(!b.node.parent)-Number(!a.node.parent));
   for(const item of sorted){vec.copy(item.pos).project(camera);const dist=camera.position.distanceTo(item.pos);let visible=vec.z>-1&&vec.z<1&&Math.abs(vec.x)<.94&&Math.abs(vec.y)<.88&&(dist<230||!item.node.parent||item.node.id===selected?.id);const x=(vec.x*.5+.5)*host.clientWidth,y=(-vec.y*.5+.5)*host.clientHeight;
    if(visible){for(let step=1;step<24;step++){const t=step/24;const x=THREE.MathUtils.lerp(camera.position.x,item.pos.x,t),z=THREE.MathUtils.lerp(camera.position.z,item.pos.z,t),y=THREE.MathUtils.lerp(camera.position.y,item.pos.y,t);if(height(x,z)>y+1){visible=false;break}}}
    if(visible&&occupied.some(p=>Math.abs(p.x-x)<110&&Math.abs(p.y-y)<33))visible=false;
    item.label.hidden=!visible;if(visible){occupied.push({x,y});item.label.style.left=x+'px';item.label.style.top=y+'px'}
   }
  }
 }
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();setStatus('三维渲染已暂停。请刷新恢复，或继续使用知识目录。');openList(true)});
 if(innerWidth<800)$('#map-hint').textContent='单指旋转 · 双指缩放 / 平移';requestAnimationFrame(animate);
 return {focus,highlight,stop};
}

import * as THREE from 'three';

// Procedural textures keep the game bundled and inexpensive on mobile.
let seed=51987;
function rand(){seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296}
function tex(w:number,h:number,draw:(c:CanvasRenderingContext2D)=>void){
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d')!;draw(ctx);
 const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
function noise(c:CanvasRenderingContext2D,w:number,h:number,n:number){
 for(let i=0;i<n;i++){
  c.fillStyle=rand()>.5?'rgba(10,18,19,'+(rand()*.1)+')':'rgba(233,225,198,'+(rand()*.06)+')';
  c.fillRect(rand()*w,rand()*h,rand()*6+1,rand()*4+1);
 }
}
function makeWall(){return tex(512,512,c=>{
 c.fillStyle='#697066';c.fillRect(0,0,512,512);
 for(let i=0;i<62;i++){
  c.fillStyle='rgba(20,34,32,'+(rand()*.09)+')';
  c.fillRect(rand()*512,rand()*512,30+rand()*140,4+rand()*13);
 }
 const g=c.createLinearGradient(0,0,0,512);g.addColorStop(0,'rgba(10,15,14,.02)');g.addColorStop(1,'rgba(4,14,16,.5)');
 c.fillStyle=g;c.fillRect(0,0,512,512);noise(c,512,512,9000);
});}
function makeFloor(){const t=tex(512,512,c=>{
 c.fillStyle='#464a3e';c.fillRect(0,0,512,512);
 for(let i=0;i<16;i++){
  const x=i*32;
  c.fillStyle=i%3===0?'#4a4f42':i%2===0?'#55594c':'#454b40';c.fillRect(x+2,0,30,512);
  c.fillStyle='rgba(6,11,13,.45)';c.fillRect(x,0,2,512);
  for(let j=0;j<48;j++){
   c.strokeStyle='rgba(12,22,22,'+(.03+rand()*.07)+')';
   c.lineWidth=rand()*1.5;c.beginPath();
   const xx=x+rand()*29,yy=rand()*512;
   c.moveTo(xx,yy);c.lineTo(xx+rand()*3,yy+rand()*30);c.stroke();
  }
 }
 for(let y=0;y<512;y+=128){c.fillStyle='rgba(4,9,13,.33)';c.fillRect(0,y,512,2);}
 noise(c,512,512,6500);
 });t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2.2,3.2);return t;
}
function makeBoard(){return tex(1024,384,c=>{
 c.fillStyle='#203d41';c.fillRect(0,0,1024,384);
 noise(c,1024,384,15000);
 c.font='26px monospace';c.fillStyle='rgba(226,239,227,.45)';
 c.fillText('OCT. 30',30,49);
 c.font='bold 78px serif';c.fillStyle='rgba(233,240,226,.32)';c.fillText('3 - 2',390,111);
 c.font='26px monospace';c.fillStyle='rgba(233,240,226,.26)';
 c.fillText('DO NOT LOOK BEHIND YOU',250,252);
 c.font='22px monospace';c.fillText('EXPOSURE / CLASSROOM No. 3',42,343);
 c.strokeStyle='rgba(210,225,216,.18)';c.lineWidth=3;
 c.beginPath();c.moveTo(130,130);c.lineTo(850,130);c.stroke();
 c.beginPath();c.arc(857,142,82,0,Math.PI*2);c.stroke();
 });}
function makeWindow(){return tex(512,512,c=>{
 const g=c.createLinearGradient(0,0,512,512);
 g.addColorStop(0,'#b1d1d4');g.addColorStop(.45,'#63818d');g.addColorStop(1,'#1d3943');
 c.fillStyle=g;c.fillRect(0,0,512,512);
 for(let i=0;i<170;i++){
  const x=rand()*512,y=rand()*512,len=30+rand()*220;
  c.strokeStyle='rgba(218,239,237,'+(.04+rand()*.23)+')';
  c.lineWidth=.5+rand()*2;c.beginPath();c.moveTo(x,y);c.lineTo(x-2,y+len);c.stroke();
 }
 c.strokeStyle='rgba(29,52,58,.94)';c.lineWidth=16;c.strokeRect(6,6,500,500);
 c.beginPath();c.moveTo(256,0);c.lineTo(256,512);c.moveTo(0,260);c.lineTo(512,260);c.stroke();
 });}
export function decorateClassroom(scene:THREE.Scene){
 const wall=makeWall(),floor=makeFloor(),board=makeBoard(),windowTexture=makeWindow();
 const floorMesh=new THREE.Mesh(new THREE.PlaneGeometry(10.2,15.35),new THREE.MeshStandardMaterial({map:floor,roughness:.96}));
 floorMesh.rotation.x=-Math.PI/2;floorMesh.position.set(0,.016,-.92);scene.add(floorMesh);
 const rear=new THREE.Mesh(new THREE.PlaneGeometry(10.1,3.53),new THREE.MeshStandardMaterial({map:wall,roughness:1}));
 rear.position.set(0,1.8,-8.47);scene.add(rear);
 const writing=new THREE.Mesh(new THREE.PlaneGeometry(6.79,1.5),new THREE.MeshStandardMaterial({map:board,roughness:.92,emissive:0x10282a,emissiveIntensity:.2}));
 writing.position.set(0,2.04,-8.285);scene.add(writing);
 for(let i=0;i<3;i++){
  const pane=new THREE.Mesh(new THREE.PlaneGeometry(2.1,1.18),new THREE.MeshBasicMaterial({map:windowTexture,transparent:true,opacity:.8,depthWrite:false,side:THREE.DoubleSide}));
  pane.rotation.y=-Math.PI/2;pane.position.set(4.92,2.2,-6+i*3.4);scene.add(pane);
  const shine=new THREE.Mesh(new THREE.PlaneGeometry(1.25,2.4),new THREE.MeshBasicMaterial({color:0x9de3e4,transparent:true,opacity:.037,depthWrite:false,side:THREE.DoubleSide}));
  shine.rotation.x=-Math.PI/2;shine.rotation.z=.33;shine.position.set(2.5,.035,-5.5+i*2.25);scene.add(shine);
 }
 const danger=new THREE.PointLight(0xcf4249,0,4.6,2);
 scene.add(danger);
 return {update(time:number,act:number,exposing:boolean,position:THREE.Vector3,age=0){
  danger.intensity=act===2&&exposing?Math.pow(Math.max(0,(age-1.03)/.62),2)*2.0:0;
  danger.position.set(position.x,position.y,position.z+.6);
 }};
}

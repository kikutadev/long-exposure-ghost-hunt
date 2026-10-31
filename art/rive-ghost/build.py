"""Rive cinematic ghost, from existing photographic artwork. No Rive scripts."""
from pathlib import Path
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[2]; HERE=Path(__file__).resolve().parent
for part in ("body", "head", "hand"):
    assert (HERE / "assets" / f"{part}.png").is_file(), part
parts=[("HAND",172,259,"hand",21,121,230),("HEAD",261,232,"head",22,122,231),("TORSO",256,384,"body",23,123,232)]
def pic(part):
    n,x,y,file,node,img,aid=part
    return f'<Node x="{x}" y="{y}" name="{n}" id="0:{node}"><Image x="-{x}" y="-{y}" originX="0" originY="0" assetId="0:{aid}" name="{file}" id="0:{img}"/></Node>'
def key(node,k,points):
    return f'<KeyedObject objectId="0:{node}"><KeyedProperty propertyKey="{k}">'+''.join(f'<KeyFrameDouble frame="{t}" value="{v}" interpolationType="3"/>' for t,v in points)+'</KeyedProperty></KeyedObject>'
anim=[
 key(22,15,[(0,-.03),(28,-.03),(46,.025),(68,.10),(84,.18),(99,.25)]),
 key(22,14,[(0,232),(28,232),(46,229),(68,219),(84,211),(99,197)]),
 key(22,16,[(0,1),(46,1),(68,1.015),(84,1.035),(99,1.045)]),
 key(21,15,[(0,-.025),(40,-.025),(63,-.06),(77,-.1),(89,-.24),(99,-.40)]),
 key(21,13,[(0,172),(48,172),(68,164),(84,157),(99,142)]),
 key(21,14,[(0,259),(50,259),(68,252),(84,229),(99,204)]),
 key(21,16,[(0,1),(49,1),(70,1.04),(85,1.22),(99,1.49)]),
 key(21,17,[(0,1),(49,1),(70,1.03),(85,1.18),(99,1.45)]),
 key(23,15,[(0,0),(54,0),(75,-.012),(99,.016)]),
 key(23,14,[(0,384),(60,384),(82,379),(99,364)]),
]
xml='<Rive version="1" kind="fragment"><Artboard width="512" height="768" name="The One Who Watches" id="0:2">'+''.join(pic(x) for x in parts)+'<LinearAnimation name="Approach" fps="60" duration="99" id="0:6">'+''.join(anim)+'</LinearAnimation></Artboard>'+''.join(f'<ImageAsset file="assets/{name}.png" name="{name}" id="0:{230+i}"/>' for i,name in enumerate(("hand","head","body")))+'</Rive>'
ET.fromstring(xml)
(HERE/"scene.rml").write_text(xml+'\n')
(HERE/"rive.yaml").write_text('name: ghost-near-rive\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n')
(HERE/".gitignore").write_text('build/\n')
print('Created Rive assets and scene')

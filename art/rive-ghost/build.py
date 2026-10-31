"""Build editable, script-free Rive animation for the third-act ghost.

Rive owns acting, Three.js owns camera depth and impossible teleports.
Source PNG masks are produced by prepare-assets.py; no external Rive account.
"""
from pathlib import Path
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
LAYERS = [
    # Name, X/Y anatomical pivot, component id, image id, image asset id.
    ('grasp', 161, 225, 21, 121, 230),
    ('sleeve', 175, 150, 22, 122, 231),
    ('head', 259, 169, 23, 123, 232),
    ('hair_left', 152, 153, 24, 124, 233),
    ('hair_right', 358, 153, 25, 125, 234),
    ('body', 256, 384, 26, 126, 235),
]
root = ET.Element('Rive', {'version':'1','kind':'fragment'})
board = ET.SubElement(root,'Artboard',{'width':'512','height':'768',
    'name':'The One Who Watches','id':'0:2','defaultStateMachineId':'0:7','styleId':'0:5'})
ET.SubElement(board,'LayoutComponentStyle',{'name':'Artboard Style','id':'0:5'})
for name,x,y,node_id,image_id,asset_id in LAYERS:
    node=ET.SubElement(board,'Node',{'x':str(x),'y':str(y),'id':f'0:{node_id}',
        'name':name.upper()})
    ET.SubElement(node,'Image',{'x':str(-x),'y':str(-y),'originX':'0',
        'originY':'0','assetId':f'0:{asset_id}', 'id':f'0:{image_id}', 'name':name})

anim=ET.SubElement(board,'LinearAnimation',{'name':'Approach',
    'fps':'60','duration':'99','id':'0:6'})
def keyed(name, prop, points):
    node_id=next(node_id for n,_,_,node_id,_,_ in LAYERS if n==name)
    obj=ET.SubElement(anim,'KeyedObject',{'objectId':f'0:{node_id}'})
    key=ET.SubElement(obj,'KeyedProperty',{'propertyKey':str(prop)})
    for frame,value in points:
        ET.SubElement(key,'KeyFrameDouble',{'frame':str(frame),
            'value':str(value),'interpolationType':'3'})

# Delayed acceleration toward the lens. The sleeve leads; the wrist follows.
keyed('head', 15, [(0,-.02),(31,-.02),(49,.02),(65,.065),(78,.10),(99,.14)])
keyed('head', 14, [(0,169),(31,169),(50,167),(69,163),(88,159),(99,156)])
keyed('head', 13, [(0,259),(49,259),(74,257),(99,254)])
keyed('sleeve', 15, [(0,0),(48,0),(66,-.015),(79,-.065),(90,-.115),(99,-.17)])
keyed('sleeve', 14, [(0,150),(48,150),(66,148),(79,140),(90,133),(99,127)])
keyed('sleeve', 13, [(0,175),(48,175),(75,173),(90,169),(99,165)])
keyed('grasp', 15, [(0,0),(50,0),(64,-.01),(76,-.065),(85,-.15),(99,-.28)])
keyed('grasp', 14, [(0,225),(49,225),(66,220),(78,214),(88,203),(99,191)])
keyed('grasp', 13, [(0,161),(49,161),(71,155),(84,147),(99,134)])
keyed('grasp', 16, [(0,1),(55,1),(75,1.03),(87,1.10),(99,1.22)])
keyed('grasp', 17, [(0,1),(55,1),(75,1.01),(87,1.07),(99,1.17)])
# Lagging left/right hair masses in opposing directions after each abrupt stop.
keyed('hair_left', 15, [(0,0),(27,0),(43,-.035),(58,.045),(68,.00),
                         (78,-.055),(89,.06),(99,-.025)])
keyed('hair_left', 13, [(0,152),(35,152),(54,146),(67,155),(80,142),(94,157),(99,150)])
keyed('hair_right', 15, [(0,0),(27,0),(46,.028),(59,-.05),(71,.016),
                          (81,.065),(92,-.06),(99,.03)])
keyed('hair_right', 13, [(0,358),(35,358),(55,363),(68,352),(81,368),(93,352),(99,360)])
keyed('body', 15, [(0,0),(57,0),(79,-.007),(99,.013)])
keyed('body', 14, [(0,384),(57,384),(81,382),(99,376)])
machine=ET.SubElement(board,'StateMachine',{'name':'Preview Acting','id':'0:7'})
layer=ET.SubElement(machine,'StateMachineLayer',{'name':'Acting','id':'0:8'})
entry=ET.SubElement(layer,'EntryState')
ET.SubElement(entry,'StateTransition',{'stateToId':'0:12'})
ET.SubElement(layer,'AnimationState',{'animationId':'0:6','id':'0:12'})
for name,_,_,_,_,asset_id in LAYERS:
    image=HERE/'assets'/f'{name}.png'
    assert image.exists(),image
    ET.SubElement(root,'ImageAsset',{'file':f'assets/{name}.png',
        'name':name,'id':f'0:{asset_id}'})
ET.indent(root,space='  ')
ET.ElementTree(root).write(HERE/'scene.rml', encoding='unicode', xml_declaration=False)
(HERE/'rive.yaml').write_text('name: ghost-near-rive\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n')
print('Rive scene generated from',len(LAYERS),'nonoverlapping photographic layers')

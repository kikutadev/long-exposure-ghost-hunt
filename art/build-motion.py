"""Headless bpy: author real NLA-ready keyframes for a notebook leaf and a school chair.
Run from project root: Blender --background art/classroom-dress.blend --python art/build-motion.py
"""
import bpy
from pathlib import Path
from math import radians

ROOT = Path(bpy.data.filepath).resolve().parent.parent
scene = bpy.context.scene
scene.render.fps = 30
scene.frame_start, scene.frame_end = 1, 90

# Make this script safe to rerun on the editable source.
for ob in list(bpy.data.objects):
    if ob.name.startswith('HAUNT_'):
        bpy.data.objects.remove(ob, do_unlink=True)
for name in ('AN_Notebook_Flip', 'AN_Chair_Scrape'):
    existing = bpy.data.actions.get(name)
    if existing:
        bpy.data.actions.remove(existing, do_unlink=True)

clue = bpy.data.collections.get('COL_Props')
if clue is None:
    clue = bpy.data.collections.new('COL_Props')
    scene.collection.children.link(clue)

def cube(name, location, dimensions, material_name, bevel=.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    item = bpy.context.object
    item.name = name
    item.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for col in list(item.users_collection):
        col.objects.unlink(item)
    clue.objects.link(item)
    item.parent = chair
    item.matrix_parent_inverse.identity()
    material = bpy.data.materials.get(material_name)
    if material:
        item.data.materials.append(material)
    if bevel:
        mod = item.modifiers.new('Soft worn edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        item.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return item

# +X sideways; Blender -Y maps to Three.js +Z; Z maps to height.
chair = bpy.data.objects.new('HAUNT_Chair', None)
clue.objects.link(chair)
chair.empty_display_type = 'CUBE'
chair.empty_display_size = .25

cube('HAUNT_Chair_Seat', (0,-.74,.61), (1.03,.65,.065), 'MAT_Leather_Brown')
cube('HAUNT_Chair_Back', (0,-.95,1.17), (1.03,.065,.44), 'MAT_Cover_Oxblood')
for x in (-.43,.43):
    cube('HAUNT_Chair_BackPost_%s' % ('L' if x<0 else 'R'), (x,-.95,.73), (.075,.08,.97), 'MAT_Leather_Brown', .008)
    for y in (-.48,-.94):
        cube('HAUNT_Chair_Leg_%.1f_%.1f' % (x,y), (x,y,.28), (.07,.07,.55), 'MAT_Leather_Brown', .007)
cube('HAUNT_Chair_UnderBrace', (0,-.75,.36), (.86,.07,.045), 'MAT_Leather_Brown', .007)

leaf = bpy.data.objects['BOOK_Page_Turning']
leaf.rotation_mode = 'XYZ'
leaf.animation_data_clear()
chair.rotation_mode = 'XYZ'
chair.animation_data_clear()

# Physical action: pause, tension, sharp page lift, hang, settle. Not a sine loop.
paper_keys = [
    (1,-.12), (8,-.12), (11,-.28), (18,-1.02),
    (22,-1.22), (31,-1.22), (40,-.55), (49,-.12),
]
for frame, angle in paper_keys:
    leaf.rotation_euler.y = angle
    leaf.keyframe_insert(data_path='rotation_euler', index=1, frame=frame, group='Leaf hinge')
leaf.animation_data.action.name = 'AN_Notebook_Flip'

# Chair: slight anticipatory lean, skid, recoil, then slowly creeps home
# before the next independent apparition. It never glides on a sine wave.
chair_keys = [
    (1,0,0), (6,-.008,-.012), (10,.10,.02),
    (15,.26,-.06), (21,.24,.022), (31,.24,0),
    (58,.24,0), (87,0,0), (90,0,0),
]
for frame, sideways, angle in chair_keys:
    chair.location.x = sideways
    chair.rotation_euler.z = angle
    chair.keyframe_insert(data_path='location', index=0, frame=frame, group='Chair scrape')
    chair.keyframe_insert(data_path='rotation_euler', index=2, frame=frame, group='Chair recoil')
chair.animation_data.action.name = 'AN_Chair_Scrape'

for source in (leaf,chair):
    # Move actions to separate NLA tracks so GLB provides stable named clips.
    action = source.animation_data.action
    track = source.animation_data.nla_tracks.new()
    track.name = action.name
    strip = track.strips.new(action.name, 1, action)
    strip.action_frame_start = 1
    strip.action_frame_end = 49 if source is leaf else 90
    source.animation_data.action = None

# QA renders on the same authored camera used to inspect the real notebook.
camera = bpy.data.objects.get('CAM_Notebook')
if camera is None:
    camera_data = bpy.data.cameras.new('QA Notebook Camera')
    camera = bpy.data.objects.new('CAM_Notebook', camera_data)
    scene.collection.objects.link(camera)
camera.location = (-1.3, 1.4, 2.35)
from mathutils import Vector
look_at = Vector((-1.15, 3.31, 1.47))
camera.rotation_euler = (look_at - camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.lens = 45
scene.camera = camera
if not [o for o in scene.objects if o.type == 'LIGHT']:
    data = bpy.data.lights.new('Notebook QA Lamp', 'AREA')
    light = bpy.data.objects.new('LGT_QA', data)
    scene.collection.objects.link(light)
    light.location = (-2, 2.3, 3.5)
    data.energy = 550
    data.shape = 'DISK'
    data.size = 3
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x = 780
scene.render.resolution_y = 780
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
for frame, name in ((1,'preview-motion-rest.png'),(22,'preview-motion-open.png')):
    scene.frame_set(frame)
    scene.render.filepath = str(ROOT / 'art' / name)
    bpy.ops.render.render(write_still=True)
scene.frame_set(1)

blend = ROOT / 'art/classroom-dress.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
bpy.ops.object.select_all(action='DESELECT')
for item in scene.objects:
    if item.name.startswith(('BOOK_','CLOCK_','HAUNT_')) and item.type in ('MESH','CURVE','EMPTY'):
        item.select_set(True)
bpy.context.view_layer.objects.active = chair
out = ROOT / 'public/assets/classroom-dress.glb'
bpy.ops.export_scene.gltf(
    filepath=str(out),
    export_format='GLB',
    use_selection=True,
    export_animations=True,
    export_animation_mode='NLA_TRACKS',
    export_nla_strips=True,
    export_anim_slide_to_zero=True,
)
print('CLIPS_READY', [a.name for a in bpy.data.actions], out)

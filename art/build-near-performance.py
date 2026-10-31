"""Blender bpy: 2.5D performance passes from the photographic ghost artwork.

The full-resolution hand/head/body textures are masks extracted from ghost-near.png.
The image is never redrawn as low-poly geometry. This is a deliberately restrained
cutout performance, with independent shoulder/neck pivot timing and parallax.
Run:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python art/build-near-performance.py
  python3 art/pack-near-performance.py
"""
import bpy
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / ".qa" / "near-performance"
OUT.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x = 512
scene.render.resolution_y = 768
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.color_depth = '8'
scene.render.film_transparent = True
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'Medium High Contrast'
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1
scene.render.fps = 30
scene.frame_start, scene.frame_end = 1, 49
scene.world.color = (.0, .0, .0)

def img_point(x, y):
    return ((x / 1024 - .5) * 2, (.5 - y / 1536) * 3)

def make_layer(name, pivot, texture_path, z):
    # Four image corners are positioned relative to anatomical pivot; this
    # allows physically understandable head and forearm animation.
    ox, oy = img_point(*pivot)
    coords = [(-1,-1.5), (1,-1.5), (1,1.5), (-1,1.5)]
    verts = [(x-ox,y-oy,0) for x,y in coords]
    mesh = bpy.data.meshes.new(name+"_MESH")
    mesh.from_pydata(verts, [], [(0,1,2,3)])
    mesh.update()
    uv = mesh.uv_layers.new()
    for poly in mesh.polygons:
        for loopidx in poly.loop_indices:
            vid = mesh.loops[loopidx].vertex_index
            uv.data[loopidx].uv = ((0,0),(1,0),(1,1),(0,1))[vid]
    obj = bpy.data.objects.new(name,mesh)
    scene.collection.objects.link(obj)
    obj.location=(ox,oy,z)
    tex=bpy.data.images.load(str(texture_path), check_existing=True)
    mat=bpy.data.materials.new("MAT_"+name)
    mat.use_nodes=True
    mat.surface_render_method = 'DITHERED'
    nodes=mat.node_tree.nodes
    nodes.clear()
    image=nodes.new("ShaderNodeTexImage")
    image.image=tex
    image.interpolation='Linear'
    emission=nodes.new("ShaderNodeEmission")
    emission.inputs['Strength'].default_value=1
    # Keep luminance unchanged by the studio lighting.
    mat.node_tree.links.new(image.outputs['Color'],emission.inputs['Color'])
    transparent=nodes.new("ShaderNodeBsdfTransparent")
    mix=nodes.new("ShaderNodeMixShader")
    mat.node_tree.links.new(image.outputs['Alpha'],mix.inputs[0])
    mat.node_tree.links.new(transparent.outputs[0],mix.inputs[1])
    mat.node_tree.links.new(emission.outputs[0],mix.inputs[2])
    out=nodes.new("ShaderNodeOutputMaterial")
    mat.node_tree.links.new(mix.outputs[0],out.inputs['Surface'])
    obj.data.materials.append(mat)
    return obj

source = ROOT / "public" / "assets"
body = make_layer("NEAR_Body", (512,768), source/"ghost-near-body.png",0)
head = make_layer("NEAR_Head", (524,475), source/"ghost-near-head.png",.006)
hand = make_layer("NEAR_Hand", (304,523), source/"ghost-near-hand.png",.015)

camera_data = bpy.data.cameras.new("CAM_NearPerformance")
camera = bpy.data.objects.new("CAM_NearPerformance",camera_data)
scene.collection.objects.link(camera)
camera.location=(0,0,8)
camera_data.type='ORTHO'
camera_data.ortho_scale=3
scene.camera=camera

# Exposure ages. Face lift anticipates the strike, while the hand stays
# nearly still until the last quarter-second. No generic sinusoidal hovering.
AGES=[0,.18,.36,.54,.70,.86,1.00,1.13,1.25,1.35,1.46,1.58]
def eased(start,end,value):
    t = min(1., max(0.,(value-start)/(end-start)))
    return t*t*(3-2*t)

neck_y = head.location.y
hand_y = hand.location.y
hand_x = hand.location.x
for i,age in enumerate(AGES):
    look=eased(.56,1.03,age)
    snap=eased(1.10,1.50,age)
    head.location.y=neck_y + .008*look+.020*snap
    head.rotation_euler=(math.radians(-1.6*look), math.radians(-8+12*look), math.radians(2.5*look))
    head.scale=(1+.018*look+.035*snap,1+.008*look+.03*snap,1)
    # An extended wrist advances in an arc toward the lens; small lean before
    # the abrupt strike keeps the shoulder connected to the underlying body.
    hand.scale=(1+.07*look+.66*snap,1+.08*look+.69*snap,1)
    hand.location.x=hand_x-.008*look-.036*snap
    hand.location.y=hand_y+.012*look+.085*snap
    hand.rotation_euler=(math.radians(-3*snap),math.radians(-4*snap), math.radians(-1.5*look-4*snap))
    hand.location.z=.015+.045*snap
    body.rotation_euler=(0,0,math.radians(-.9*look))
    body.scale=(1+.008*look,1+.003*look,1)
    for obj in (body,head,hand):
        obj.keyframe_insert(data_path="location",frame=1+int(age*30))
        obj.keyframe_insert(data_path="rotation_euler",frame=1+int(age*30))
        obj.keyframe_insert(data_path="scale",frame=1+int(age*30))
    scene.frame_set(1+int(age*30))
    scene.render.filepath=str(OUT/("pose-%02d.png" % i))
    bpy.ops.render.render(write_still=True)
    print("NEAR_POSE",i,age,scene.render.filepath,flush=True)

bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"near-performance.blend"))
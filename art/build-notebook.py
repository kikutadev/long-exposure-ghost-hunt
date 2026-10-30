"""Build and export a hinged, gently curved paper leaf inside the existing notebook.
Run with Blender --background art/classroom-dress.blend --python art/build-notebook.py.
No GUI, Blender MCP, or direct glTF mesh editing is used.
"""
import bpy, math
from pathlib import Path
from mathutils import Vector

book = bpy.data.objects
old = book.get('BOOK_Page_Turning')
if old:
    bpy.data.objects.remove(old, do_unlink=True)
old_floating = book.get('BOOK_Page_Floating')
if old_floating:
    # The original free-floating board does not look like a physical sheet.
    bpy.data.objects.remove(old_floating, do_unlink=True)

PROJECT = Path(bpy.data.filepath).resolve().parent.parent
# Spine is where the left/right covers meet. A leaf is hinged along its Y edge.
spine = (-1.15, 3.312, 1.469)
length = 0.475
halfheight = 0.265
cols, rows = 12, 10
verts, faces = [], []
for j in range(rows + 1):
    v = j / rows
    for i in range(cols + 1):
        u = i / cols
        # Slight rippling, curvature becomes pronounced at the outside corner.
        z = .014 * math.sin(u * math.pi) + .012 * u * u * (2 * v - 1)
        verts.append((length * u, halfheight * (2 * v - 1), z))
for j in range(rows):
    for i in range(cols):
        n = j * (cols + 1) + i
        faces.append((n, n + 1, n + cols + 2, n + cols + 1))
mesh = bpy.data.meshes.new('leaf_curved_grid')
mesh.from_pydata(verts, [], faces)
mesh.update()
page = bpy.data.objects.new('BOOK_Page_Turning', mesh)
bpy.data.collections['COL_Notebook'].objects.link(page)
page.location = spine
page.rotation_euler = (.35, 0, 0)
mat = bpy.data.materials.get('MAT_Paper_Ivory')
if mat:
    mesh.materials.append(mat)
for poly in mesh.polygons:
    poly.use_smooth = True

# Subtle folded margin and ink line details, children rotate with page.
for n, proportion in enumerate((.29, .43, .57, .71)):
    line = bpy.data.objects.get(f'BOOK_Page_Ink_{n}')
    if not line:
        curve = bpy.data.curves.new(f'ink_line_{n}', 'CURVE')
        curve.dimensions = '3D'
        curve.bevel_depth = .0011
        curve.bevel_resolution = 1
        spline = curve.splines.new('POLY')
        spline.points.add(5)
        for i, pt in enumerate(spline.points):
            u = .23 + i * .11
            z = .014 * math.sin(u * math.pi) + .012 * u * u * (2 * proportion - 1)
            pt.co = (length * u, halfheight * (2 * proportion - 1), z + .003, 1)
        line = bpy.data.objects.new(f'BOOK_Page_Ink_{n}', curve)
        bpy.data.collections['COL_Notebook'].objects.link(line)
        ink = bpy.data.materials.get('MAT_Black_Ink')
        if ink:
            curve.materials.append(ink)
    line.parent = page
    line.location = (0, 0, 0)
    line.rotation_euler = (0, 0, 0)

# Render from the existing authored camera at the action's peak for QA.
camera = book.get('CAM_Notebook')
if camera:
    bpy.context.scene.camera = camera
    camera.data.lens = 50
page.rotation_euler.y = -1.0
bpy.context.scene.render.engine = 'BLENDER_EEVEE_NEXT'
bpy.context.scene.render.resolution_x = 900
bpy.context.scene.render.resolution_y = 900
bpy.context.scene.render.resolution_percentage = 100
bpy.context.scene.render.image_settings.file_format = 'PNG'
bpy.context.scene.render.filepath = str(PROJECT / 'art/preview-hinged-page.png')
bpy.ops.render.render(write_still=True)

# Store natural flat initial state. Gameplay makes the paper flip around the spine.
page.rotation_euler.y = -.12

bpy.ops.wm.save_as_mainfile(filepath=str(PROJECT / 'art/classroom-dress.blend'))
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.context.scene.objects:
    if obj.name.startswith(('BOOK_', 'CLOCK_')) and obj.type in ('MESH', 'CURVE'):
        obj.select_set(True)
bpy.context.view_layer.objects.active = page
bpy.ops.export_scene.gltf(filepath=str(PROJECT / 'public/assets/classroom-dress.glb'),
    export_format='GLB', use_selection=True, export_animations=False)
print('HEADLESS_BPY_DONE',len([o for o in bpy.context.scene.objects if o.select_get()]),
    str(PROJECT / 'public/assets/classroom-dress.glb'))

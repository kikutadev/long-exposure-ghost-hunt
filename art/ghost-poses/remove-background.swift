import Foundation
import Vision
import CoreImage
import AppKit
import ImageIO
import UniformTypeIdentifiers

guard CommandLine.arguments.count == 3 else {
    fputs("usage: swift remove-background.swift input.png output.png\n", stderr)
    exit(2)
}
let src = URL(fileURLWithPath: CommandLine.arguments[1])
let dst = URL(fileURLWithPath: CommandLine.arguments[2])
let request = VNGenerateForegroundInstanceMaskRequest()
let handler = VNImageRequestHandler(url: src, options: [:])
try handler.perform([request])
guard let result = request.results?.first else {
    fatalError("Vision could not identify a foreground figure in \(src.path)")
}
let buffer = try result.generateScaledMaskForImage(forInstances: result.allInstances, from: handler)
guard let original = CIImage(contentsOf: src) else { fatalError("Image could not be read") }
let mask = CIImage(cvPixelBuffer: buffer)
let clear = CIImage(color: CIColor(red: 0, green: 0, blue: 0, alpha: 0)).cropped(to: original.extent)
let cutout = original.applyingFilter("CIBlendWithMask", parameters: [
    kCIInputBackgroundImageKey: clear,
    kCIInputMaskImageKey: mask
])
let ctx = CIContext(options: [.useSoftwareRenderer: false])
guard let output = ctx.createCGImage(cutout, from: original.extent) else { fatalError("Mask render failed") }
let bitmap = NSBitmapImageRep(cgImage: output)
guard let data = bitmap.representation(using: .png, properties: [:]) else { fatalError("PNG encoding failed") }
try data.write(to: dst, options: .atomic)
print("BACKGROUND_REMOVED \(src.lastPathComponent) => \(dst.lastPathComponent) \(data.count) bytes")

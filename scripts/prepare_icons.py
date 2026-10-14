import os
from PIL import Image

source_jpg = r"C:\Users\HOSS\.gemini\antigravity\brain\78079161-7de2-40c2-a02f-c33d9dd999bd\pinko_app_icon_1792000818054.jpg"
root_dir = r"D:\araby-tech projects\PINKO APP"

os.makedirs(os.path.join(root_dir, "assets"), exist_ok=True)
os.makedirs(os.path.join(root_dir, "release"), exist_ok=True)
os.makedirs(os.path.join(root_dir, "desktop", "public"), exist_ok=True)
os.makedirs(os.path.join(root_dir, "mobile", "public"), exist_ok=True)

img = Image.open(source_jpg)
print(f"Original size: {img.size}")

# 1. High-res PNG (1024x1024)
png_1024 = img.resize((1024, 1024), Image.Resampling.LANCZOS)
png_1024.save(os.path.join(root_dir, "assets", "icon.png"), format="PNG")
png_1024.save(os.path.join(root_dir, "release", "PinkoApp-Icon.png"), format="PNG")
png_1024.save(os.path.join(root_dir, "desktop", "public", "icon.png"), format="PNG")
png_1024.save(os.path.join(root_dir, "mobile", "public", "icon.png"), format="PNG")

# 2. 512x512 PNG
png_512 = img.resize((512, 512), Image.Resampling.LANCZOS)
png_512.save(os.path.join(root_dir, "assets", "icon-512.png"), format="PNG")
png_512.save(os.path.join(root_dir, "desktop", "public", "icon-512.png"), format="PNG")
png_512.save(os.path.join(root_dir, "mobile", "public", "icon-512.png"), format="PNG")

# 3. 192x192 PNG
png_192 = img.resize((192, 192), Image.Resampling.LANCZOS)
png_192.save(os.path.join(root_dir, "assets", "icon-192.png"), format="PNG")
png_192.save(os.path.join(root_dir, "desktop", "public", "icon-192.png"), format="PNG")
png_192.save(os.path.join(root_dir, "mobile", "public", "icon-192.png"), format="PNG")

# 4. Multi-resolution ICO for Windows Desktop
ico_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
png_1024.save(
    os.path.join(root_dir, "assets", "icon.ico"),
    format="ICO",
    sizes=ico_sizes
)
png_1024.save(
    os.path.join(root_dir, "release", "PinkoApp-Icon.ico"),
    format="ICO",
    sizes=ico_sizes
)
png_1024.save(
    os.path.join(root_dir, "desktop", "public", "favicon.ico"),
    format="ICO",
    sizes=ico_sizes
)
png_1024.save(
    os.path.join(root_dir, "mobile", "public", "favicon.ico"),
    format="ICO",
    sizes=ico_sizes
)

print("✅ All icons (PNG & multi-res ICO) generated and distributed successfully!")

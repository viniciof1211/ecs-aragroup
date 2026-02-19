"""Generate favicon.ico and logo PNGs from the ECS logo image."""
import os
from PIL import Image

# The user uploaded the ECS logo - we need to find it
# Check common temp/download locations
candidates = [
    r"C:\Users\vinicio.flores\AppData\Local\Temp",
    r"C:\Users\vinicio.flores\Downloads",
]

# We'll create a simple green ECS-themed favicon programmatically
# since we can't reliably locate the uploaded temp file
from PIL import Image, ImageDraw

def create_ecs_icon(size):
    """Create a simple ECS-branded icon with the infinity/network motif."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Background circle
    margin = size // 10
    draw.ellipse([margin, margin, size - margin, size - margin], fill="#1A4A28")
    
    # Inner lighter circle
    inner = size // 5
    draw.ellipse([inner, inner, size - inner, size - inner], fill="#2A6A3A")
    
    # Center dot
    center = size // 3
    draw.ellipse([center, center, size - center, size - center], fill="#FFFFFF")
    
    # ECS text would be too small for favicon, so just use the branded circle
    return img

OUT = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public")

# Generate multiple sizes
sizes = [16, 32, 48, 64, 128, 192, 512]
icons = {}
for s in sizes:
    icons[s] = create_ecs_icon(s)

# Save favicon.ico (multi-size)
ico_path = os.path.join(OUT, "favicon.ico")
icons[32].save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
print(f"Created {ico_path}")

# Save individual PNGs for PWA/meta tags
for s in [192, 512]:
    png_path = os.path.join(OUT, f"ecs-logo-{s}.png")
    icons[s].save(png_path, format="PNG")
    print(f"Created {png_path}")

# Save the main logo
logo_path = os.path.join(OUT, "ecs-logo.png")
icons[128].save(logo_path, format="PNG")
print(f"Created {logo_path}")

print("Done!")

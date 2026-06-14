from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "media" / "autovyne-demo-walkthrough.gif"
OUT.parent.mkdir(parents=True, exist_ok=True)

W, H = 1280, 720
BG = (7, 8, 12)
CARD = (18, 21, 31)
CARD_2 = (24, 28, 40)
FG = (238, 244, 241)
MUTED = (146, 153, 169)
ACCENT = (0, 232, 123)
YELLOW = (255, 209, 102)


def font(size, bold=False):
    candidates = [
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default()


FONT_XL = font(62, True)
FONT_L = font(40, True)
FONT_M = font(27, True)
FONT_R = font(25)
FONT_S = font(19)
FONT_CAPTION = font(17)
FONT_XS = font(16, True)


slides = [
    {
        "kicker": "STEP 01",
        "title": "Start with Signup",
        "body": "A customer chooses a monthly plan, enters business details, creates a portal password, and decides whether SMS consent applies.",
        "screen": "signup",
        "narration": "First, the owner starts signup. They choose a plan, billing method, and enter the basic business details Autovyne needs for onboarding.",
    },
    {
        "kicker": "STEP 02",
        "title": "Pay or Request Manual Billing",
        "body": "Automatic billing sends them to Stripe. Manual billing creates a review item for Autovyne before activation.",
        "screen": "payment",
        "narration": "Next, payment decides the activation path. Stripe subscriptions can activate automatically after checkout, while manual billing stays under Autovyne review.",
    },
    {
        "kicker": "STEP 03",
        "title": "Autovyne Activates the Portal",
        "body": "After payment or approval, the customer logs in with email plus the portal password or access code.",
        "screen": "activation",
        "narration": "Once the account is approved, the client portal becomes the simple home base for status, setup progress, and customer support.",
    },
    {
        "kicker": "STEP 04",
        "title": "Customer Sees What Is Running",
        "body": "The portal shows calls helped, texts sent, lead movement, estimated recovery, active services, and setup checklist items.",
        "screen": "portal",
        "narration": "Inside the portal, the customer does not need HubSpot, Twilio, n8n, or Stripe tabs. They see the plain-English version of what is happening.",
    },
    {
        "kicker": "STEP 05",
        "title": "Use Action Center Safely",
        "body": "Customers can request caller blocks, pauses, reviews, privacy help, or workflow changes without touching the technical stack.",
        "screen": "actions",
        "narration": "If a customer wants to block a caller, pause follow-up, or request review, they use Action Center. Autovyne reviews requests before changing outreach.",
    },
    {
        "kicker": "DEMO LOGIN",
        "title": "Demo Account for Walkthroughs",
        "body": "Use demo@autovyne.com with access code AutovyneDemo2026! to preview the activated customer experience.",
        "screen": "demo",
        "narration": "For sales demos, use the demo account. It shows a live-style portal without exposing real customer data.",
    },
]


def rounded(draw, xy, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def text(draw, xy, value, fill, fnt, max_width=None, line_gap=8):
    if not max_width:
        draw.text(xy, value, fill=fill, font=fnt)
        return
    words = value.split()
    lines, current = [], ""
    for word in words:
        trial = (current + " " + word).strip()
        if draw.textlength(trial, font=fnt) <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    x, y = xy
    for line in lines:
        draw.text((x, y), line, fill=fill, font=fnt)
        y += fnt.size + line_gap


def gradient_bg():
    img = Image.new("RGB", (W, H), BG)
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.ellipse((-260, -220, 620, 620), fill=(0, 232, 123, 34))
    draw.ellipse((760, -180, 1460, 520), fill=(92, 79, 255, 28))
    return Image.alpha_composite(img.convert("RGBA"), overlay)


def draw_browser(draw, x, y, w, h, title):
    rounded(draw, (x, y, x + w, y + h), 28, CARD, (255, 255, 255, 22), 2)
    rounded(draw, (x + 16, y + 14, x + w - 16, y + 58), 16, (11, 13, 19), None)
    for i, c in enumerate([(255, 92, 92), (255, 209, 102), ACCENT]):
        draw.ellipse((x + 34 + i * 24, y + 30, x + 46 + i * 24, y + 42), fill=c)
    draw.text((x + 128, y + 27), title, fill=MUTED, font=FONT_S)


def draw_screen(draw, name):
    x, y, w, h = 610, 92, 580, 496
    draw_browser(draw, x, y, w, h, "autovyne.com")
    bx, by = x + 34, y + 88
    if name == "signup":
        draw.text((bx, by), "Signup + Payment + Onboarding", fill=ACCENT, font=FONT_XS)
        draw.text((bx, by + 34), "Start Autovyne", fill=FG, font=FONT_L)
        labels = ["Business name", "Email", "Industry", "Monthly plan", "Portal password"]
        for i, label in enumerate(labels):
            yy = by + 102 + i * 54
            draw.text((bx, yy - 24), label, fill=MUTED, font=FONT_XS)
            rounded(draw, (bx, yy, bx + 500, yy + 36), 10, CARD_2, (255, 255, 255, 24))
        rounded(draw, (bx, by + 390, bx + 500, by + 438), 14, ACCENT)
        draw.text((bx + 190, by + 402), "Continue", fill=(4, 12, 8), font=FONT_M)
    elif name == "payment":
        draw.text((bx, by), "Stripe Checkout", fill=ACCENT, font=FONT_XS)
        draw.text((bx, by + 42), "$499 / month", fill=FG, font=FONT_XL)
        for i, row in enumerate(["Secure monthly subscription", "Customer portal after payment", "Cancel before next billing period"]):
            yy = by + 134 + i * 62
            draw.ellipse((bx, yy, bx + 18, yy + 18), fill=ACCENT)
            draw.text((bx + 34, yy - 4), row, fill=FG, font=FONT_R)
        rounded(draw, (bx, by + 360, bx + 500, by + 420), 16, ACCENT)
        draw.text((bx + 156, by + 376), "Subscribe", fill=(4, 12, 8), font=FONT_M)
    elif name == "activation":
        draw.text((bx, by), "Client Portal", fill=ACCENT, font=FONT_XS)
        draw.text((bx, by + 34), "Open My Dashboard", fill=FG, font=FONT_L)
        for i, label in enumerate(["Email", "Portal Password or Access Code"]):
            yy = by + 112 + i * 86
            draw.text((bx, yy - 26), label, fill=MUTED, font=FONT_XS)
            rounded(draw, (bx, yy, bx + 500, yy + 44), 12, CARD_2, (255, 255, 255, 24))
        rounded(draw, (bx, by + 320, bx + 500, by + 374), 15, ACCENT)
        draw.text((bx + 146, by + 335), "Log In", fill=(4, 12, 8), font=FONT_M)
    elif name == "portal":
        draw.text((bx, by), "Autovyne Demo HVAC", fill=FG, font=FONT_L)
        metrics = [("48", "Calls"), ("31", "Texts"), ("19", "Leads"), ("$8.4K", "Recovered")]
        for i, (value, label) in enumerate(metrics):
            cx = bx + (i % 2) * 250
            cy = by + 88 + (i // 2) * 132
            rounded(draw, (cx, cy, cx + 226, cy + 104), 16, CARD_2, (255, 255, 255, 18))
            draw.text((cx + 18, cy + 16), value, fill=ACCENT, font=FONT_L)
            draw.text((cx + 18, cy + 68), label, fill=MUTED, font=FONT_S)
        rounded(draw, (bx, by + 360, bx + 500, by + 418), 16, (0, 232, 123, 42), (0, 232, 123, 95), 2)
        draw.text((bx + 22, by + 376), "AI Calling • SMS • CRM • n8n", fill=FG, font=FONT_M)
    elif name == "actions":
        draw.text((bx, by), "Action Center", fill=ACCENT, font=FONT_XS)
        draw.text((bx, by + 34), "Request a safe change", fill=FG, font=FONT_L)
        opts = ["Block caller", "Pause follow-up", "Review lead", "Privacy request"]
        for i, opt in enumerate(opts):
            yy = by + 112 + i * 56
            rounded(draw, (bx, yy, bx + 500, yy + 38), 12, CARD_2, (255, 255, 255, 24))
            draw.text((bx + 16, yy + 8), opt, fill=FG, font=FONT_S)
        rounded(draw, (bx, by + 374, bx + 500, by + 426), 15, ACCENT)
        draw.text((bx + 128, by + 388), "Submit Control Request", fill=(4, 12, 8), font=FONT_M)
    else:
        draw.text((bx, by), "Demo Account", fill=ACCENT, font=FONT_XS)
        draw.text((bx, by + 42), "Autovyne Demo HVAC", fill=FG, font=FONT_L)
        rounded(draw, (bx, by + 120, bx + 500, by + 196), 18, CARD_2, (255, 255, 255, 24))
        draw.text((bx + 20, by + 138), "Email", fill=MUTED, font=FONT_XS)
        draw.text((bx + 20, by + 162), "demo@autovyne.com", fill=FG, font=FONT_R)
        rounded(draw, (bx, by + 226, bx + 500, by + 302), 18, CARD_2, (255, 255, 255, 24))
        draw.text((bx + 20, by + 244), "Access code", fill=MUTED, font=FONT_XS)
        draw.text((bx + 20, by + 268), "AutovyneDemo2026!", fill=FG, font=FONT_R)
        rounded(draw, (bx, by + 360, bx + 500, by + 418), 16, YELLOW)
        draw.text((bx + 112, by + 376), "Use for sales walkthroughs", fill=(12, 10, 2), font=FONT_M)


def make_frame(slide, progress):
    img = gradient_bg()
    draw = ImageDraw.Draw(img)
    draw.text((76, 74), "AUTOVYNE WALKTHROUGH", fill=ACCENT, font=FONT_XS)
    draw.text((76, 118), slide["kicker"], fill=YELLOW, font=FONT_M)
    text(draw, (76, 168), slide["title"], FG, FONT_XL, max_width=470, line_gap=6)
    text(draw, (78, 324), slide["body"], MUTED, FONT_R, max_width=470, line_gap=8)
    rounded(draw, (76, 506, 546, 652), 20, (6, 8, 13, 208), (255, 255, 255, 26), 2)
    draw.text((102, 528), "Narration", fill=ACCENT, font=FONT_XS)
    text(draw, (102, 558), slide["narration"], FG, FONT_CAPTION, max_width=410, line_gap=4)
    draw_screen(draw, slide["screen"])
    rounded(draw, (76, 674, 1204, 688), 999, (255, 255, 255, 28))
    rounded(draw, (76, 674, int(76 + 1128 * progress), 688), 999, ACCENT)
    return img.convert("P", palette=Image.Palette.ADAPTIVE)


frames = []
for index, slide in enumerate(slides):
    for hold in range(18):
        frames.append(make_frame(slide, (index + hold / 18) / len(slides)))

frames[0].save(
    OUT,
    save_all=True,
    append_images=frames[1:],
    duration=115,
    loop=0,
    optimize=True,
)
print(OUT)
